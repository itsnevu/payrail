import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/** Offchain mirror of PaymentProcessor.invoiceKey: keccak256(abi.encode(salt, merchant, amount)). */
function invoiceKey(salt: string, merchant: string, amount: bigint): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [salt, merchant, amount]),
  );
}

describe("PaymentProcessor", () => {
  async function fixture() {
    const [deployer, merchant, payer, attacker] = await ethers.getSigners();
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const pp = await (await ethers.getContractFactory("PaymentProcessor")).deploy(await usdc.getAddress());
    await usdc.mint(payer.address, 1_000_000_000n); // 1,000 USDC
    await usdc.mint(attacker.address, 1_000_000_000n);
    const ppAddr = await pp.getAddress();
    return { deployer, merchant, payer, attacker, usdc, pp, ppAddr };
  }

  const salt = ethers.keccak256(ethers.toUtf8Bytes("inv-001"));
  const amount = 25_000_000n; // 25 USDC

  describe("constructor", () => {
    it("rejects the zero address and non-contract addresses as the token", async () => {
      const { payer } = await loadFixture(fixture);
      const F = await ethers.getContractFactory("PaymentProcessor");
      await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(F, "InvalidToken");
      await expect(F.deploy(payer.address)).to.be.revertedWithCustomError(F, "InvalidToken");
    });
  });

  describe("invoiceKey", () => {
    it("matches the offchain derivation", async () => {
      const { pp, merchant } = await loadFixture(fixture);
      expect(await pp.invoiceKey(salt, merchant.address, amount)).to.equal(invoiceKey(salt, merchant.address, amount));
    });

    it("changes when any term changes", async () => {
      const { pp, merchant, attacker } = await loadFixture(fixture);
      const base = await pp.invoiceKey(salt, merchant.address, amount);
      expect(await pp.invoiceKey(salt, attacker.address, amount)).to.not.equal(base);
      expect(await pp.invoiceKey(salt, merchant.address, amount + 1n)).to.not.equal(base);
      expect(await pp.invoiceKey(ethers.keccak256(ethers.toUtf8Bytes("other")), merchant.address, amount)).to.not.equal(base);
    });
  });

  describe("pay", () => {
    it("transfers USDC straight to the merchant, records the payment and emits the event", async () => {
      const { merchant, payer, usdc, pp, ppAddr } = await loadFixture(fixture);
      await usdc.connect(payer).approve(ppAddr, amount);
      const key = invoiceKey(salt, merchant.address, amount);

      const tx = await pp.connect(payer).pay(salt, merchant.address, amount);
      const block = await ethers.provider.getBlock((await tx.wait())!.blockNumber);

      await expect(tx)
        .to.emit(pp, "PaymentReceived")
        .withArgs(key, salt, merchant.address, payer.address, amount, block!.timestamp);

      expect(await usdc.balanceOf(merchant.address)).to.equal(amount);
      expect(await usdc.balanceOf(ppAddr)).to.equal(0n);
      expect(await usdc.balanceOf(payer.address)).to.equal(1_000_000_000n - amount);
      expect(await pp.isPaid(key)).to.equal(true);

      const p = await pp.getPayment(key);
      expect(p.payer).to.equal(payer.address);
      expect(p.merchant).to.equal(merchant.address);
      expect(p.amount).to.equal(amount);
      expect(p.paidAt).to.equal(BigInt(block!.timestamp));
    });

    it("rejects paying the same terms twice", async () => {
      const { merchant, payer, usdc, pp, ppAddr } = await loadFixture(fixture);
      await usdc.connect(payer).approve(ppAddr, amount * 2n);
      await pp.connect(payer).pay(salt, merchant.address, amount);
      await expect(pp.connect(payer).pay(salt, merchant.address, amount))
        .to.be.revertedWithCustomError(pp, "InvoiceAlreadyPaid")
        .withArgs(invoiceKey(salt, merchant.address, amount));
    });

    it("rejects zero amount, amounts above uint96, zero merchant and the contract itself as merchant", async () => {
      const { merchant, payer, pp, ppAddr } = await loadFixture(fixture);
      await expect(pp.connect(payer).pay(salt, merchant.address, 0)).to.be.revertedWithCustomError(pp, "InvalidAmount");
      await expect(pp.connect(payer).pay(salt, merchant.address, 2n ** 96n)).to.be.revertedWithCustomError(pp, "InvalidAmount");
      await expect(pp.connect(payer).pay(salt, ethers.ZeroAddress, amount)).to.be.revertedWithCustomError(pp, "InvalidMerchant");
      await expect(pp.connect(payer).pay(salt, ppAddr, amount)).to.be.revertedWithCustomError(pp, "InvalidMerchant");
    });

    it("reverts without allowance and without balance, and records nothing", async () => {
      const { merchant, payer, deployer, usdc, pp, ppAddr } = await loadFixture(fixture);
      await expect(pp.connect(payer).pay(salt, merchant.address, amount)).to.be.reverted;
      await usdc.connect(deployer).approve(ppAddr, amount); // deployer has allowance but no balance
      await expect(pp.connect(deployer).pay(salt, merchant.address, amount)).to.be.reverted;
      expect(await pp.isPaid(invoiceKey(salt, merchant.address, amount))).to.equal(false);
    });

    it("reverts when the token returns false instead of reverting (SafeERC20)", async () => {
      const { merchant, payer } = await loadFixture(fixture);
      const bad = await (await ethers.getContractFactory("FalseReturnToken")).deploy();
      const pp = await (await ethers.getContractFactory("PaymentProcessor")).deploy(await bad.getAddress());
      await expect(pp.connect(payer).pay(salt, merchant.address, amount)).to.be.reverted;
      expect(await pp.isPaid(invoiceKey(salt, merchant.address, amount))).to.equal(false);
    });

    it("lets anyone pay an invoice, not only the buyer who opened the link", async () => {
      const { merchant, attacker, usdc, pp, ppAddr } = await loadFixture(fixture);
      await usdc.connect(attacker).approve(ppAddr, amount);
      await pp.connect(attacker).pay(salt, merchant.address, amount);
      expect(await pp.isPaid(invoiceKey(salt, merchant.address, amount))).to.equal(true);
      expect(await usdc.balanceOf(merchant.address)).to.equal(amount);
    });
  });

  describe("griefing resistance (v1 regression)", () => {
    it("paying the wrong merchant with a known salt does not lock the real invoice", async () => {
      const { merchant, payer, attacker, usdc, pp, ppAddr } = await loadFixture(fixture);

      // Attacker learns the salt and pays 1 unit to themselves.
      await usdc.connect(attacker).approve(ppAddr, 1n);
      await pp.connect(attacker).pay(salt, attacker.address, 1n);
      expect(await pp.isPaid(invoiceKey(salt, attacker.address, 1n))).to.equal(true);

      // The real terms are untouched and the real buyer can still pay.
      const realKey = invoiceKey(salt, merchant.address, amount);
      expect(await pp.isPaid(realKey)).to.equal(false);
      await usdc.connect(payer).approve(ppAddr, amount);
      await expect(pp.connect(payer).pay(salt, merchant.address, amount)).to.emit(pp, "PaymentReceived");
      expect(await pp.isPaid(realKey)).to.equal(true);
      expect(await usdc.balanceOf(merchant.address)).to.equal(amount);
    });

    it("paying the wrong amount to the right merchant does not lock the real invoice", async () => {
      const { merchant, payer, attacker, usdc, pp, ppAddr } = await loadFixture(fixture);
      await usdc.connect(attacker).approve(ppAddr, 1n);
      await pp.connect(attacker).pay(salt, merchant.address, 1n);

      const realKey = invoiceKey(salt, merchant.address, amount);
      expect(await pp.isPaid(realKey)).to.equal(false);
      await usdc.connect(payer).approve(ppAddr, amount);
      await pp.connect(payer).pay(salt, merchant.address, amount);
      expect(await pp.isPaid(realKey)).to.equal(true);
    });
  });
});

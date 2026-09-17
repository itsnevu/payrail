import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name, "| Deployer:", deployer.address);

  let usdcAddress = process.env.USDC_ADDRESS;
  if (network.name === "hardhat" || network.name === "localhost") {
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    // Mint 10,000 USDC to the first 3 hardhat accounts for testing
    const signers = await ethers.getSigners();
    for (const s of signers.slice(0, 3)) await usdc.mint(s.address, 10_000_000_000n);
    console.log("MockUSDC:", usdcAddress);
  }
  if (!usdcAddress || !/^0x[0-9a-fA-F]{40}$/.test(usdcAddress)) {
    throw new Error(`USDC_ADDRESS is missing or invalid for network ${network.name}. Set the verified USDC address in .env.`);
  }

  const pp = await (await ethers.getContractFactory("PaymentProcessor")).deploy(usdcAddress);
  await pp.waitForDeployment();
  const ppAddress = await pp.getAddress();
  console.log("PaymentProcessor:", ppAddress);

  // Write addresses + ABI into the web app so frontend and backend stay in sync
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    usdc: usdcAddress,
    paymentProcessor: ppAddress,
    deployedAt: new Date().toISOString(),
  };
  const webDir = path.join(__dirname, "..", "..", "web", "src", "lib");
  fs.mkdirSync(webDir, { recursive: true });
  fs.writeFileSync(path.join(webDir, "deployment.json"), JSON.stringify(out, null, 2));

  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "PaymentProcessor.sol", "PaymentProcessor.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(
    path.join(webDir, "PaymentProcessor.abi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log("Wrote web/src/lib/deployment.json & PaymentProcessor.abi.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys PaymentProcessor (and MockUSDC on local networks) and records the result in
 * two places, keyed by chain id so several chains coexist:
 *
 *   contracts/deployments/<chainId>.json   per-chain record, meant to be committed
 *   web/src/lib/deployments.json           map { [chainId]: record } the web app reads
 *
 * USDC address resolution for non-local networks, first match wins:
 *   USDC_ADDRESS_<NETWORK>   e.g. USDC_ADDRESS_ROBINHOODMAINNET
 *   USDC_ADDRESS             legacy single-chain variable
 * The script refuses to deploy against a value that is not a checksummed-looking address.
 */

type Record_ = { network: string; chainId: number; usdc: string; paymentProcessor: string; deployedAt: string };

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error(`No deployer for network ${network.name}. Set DEPLOYER_PRIVATE_KEY in .env.`);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log("Network:", network.name, "| chainId:", chainId, "| Deployer:", deployer.address);

  const isLocal = network.name === "hardhat" || network.name === "localhost";
  const envKey = `USDC_ADDRESS_${network.name.toUpperCase()}`;
  let usdcAddress = process.env[envKey] || process.env.USDC_ADDRESS;

  if (isLocal) {
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    // Mint 10,000 USDC to the first 3 hardhat accounts for testing
    const signers = await ethers.getSigners();
    for (const s of signers.slice(0, 3)) await usdc.mint(s.address, 10_000_000_000n);
    console.log("MockUSDC:", usdcAddress);
  }
  if (!usdcAddress || !/^0x[0-9a-fA-F]{40}$/.test(usdcAddress)) {
    throw new Error(`USDC address is missing or invalid for network ${network.name}. Set ${envKey} (or USDC_ADDRESS) in .env to the verified USDC contract.`);
  }
  if (!isLocal) {
    const code = await ethers.provider.getCode(usdcAddress);
    if (code === "0x") throw new Error(`${usdcAddress} has no code on chain ${chainId}; wrong USDC address or wrong network.`);
  }

  const pp = await (await ethers.getContractFactory("PaymentProcessor")).deploy(usdcAddress);
  await pp.waitForDeployment();
  const ppAddress = await pp.getAddress();
  console.log("PaymentProcessor:", ppAddress);

  const record: Record_ = {
    network: network.name,
    chainId,
    usdc: usdcAddress,
    paymentProcessor: ppAddress,
    deployedAt: new Date().toISOString(),
  };

  // 1) per-chain record under version control
  const recDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(recDir, { recursive: true });
  fs.writeFileSync(path.join(recDir, `${chainId}.json`), JSON.stringify(record, null, 2) + "\n");

  // 2) merge into the web app's map (other chains' entries are kept)
  const webDir = path.join(__dirname, "..", "..", "web", "src", "lib");
  fs.mkdirSync(webDir, { recursive: true });
  const mapPath = path.join(webDir, "deployments.json");
  let map: Record<string, Record_> = {};
  try { map = JSON.parse(fs.readFileSync(mapPath, "utf8")); } catch { /* first deploy */ }
  map[String(chainId)] = record;
  const ordered = Object.fromEntries(Object.keys(map).sort((a, b) => Number(a) - Number(b)).map((k) => [k, map[k]]));
  fs.writeFileSync(mapPath, JSON.stringify(ordered, null, 2) + "\n");

  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "PaymentProcessor.sol", "PaymentProcessor.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(
    path.join(webDir, "PaymentProcessor.abi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log(`Wrote contracts/deployments/${chainId}.json, web/src/lib/deployments.json & PaymentProcessor.abi.json`);
  if (!isLocal) {
    console.log(`Verify: npx hardhat verify --network ${network.name} ${ppAddress} ${usdcAddress}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

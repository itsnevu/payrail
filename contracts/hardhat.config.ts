import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

// The "0x..." placeholder from .env.example is ignored so local networks keep working.
const deployerKey = /^0x[0-9a-fA-F]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY ?? "")
  ? [process.env.DEPLOYER_PRIVATE_KEY as string]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    // MUST verify the official Arc chainId and RPC from the Circle docs before deploying.
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: Number(process.env.ARC_CHAIN_ID || 5042),
      accounts: deployerKey,
    },
    // Mainnet has no defaults on purpose: every value must come from a verified .env.
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "http://unset.invalid",
      chainId: Number(process.env.ARC_MAINNET_CHAIN_ID || 0),
      accounts: deployerKey,
    },
  },
  etherscan: {
    // Fill in from the target explorer to enable `npx hardhat verify`.
    apiKey: process.env.EXPLORER_API_KEY || "",
  },
};

export default config;

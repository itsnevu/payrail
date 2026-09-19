import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Networks Payrail deploys PaymentProcessor to. One deployment per chain; the web app
 * reads them all from web/src/lib/deployments.json (written by scripts/deploy.ts).
 *
 *   localhost          hardhat node, MockUSDC, chain 31337
 *   arcTestnet         Arc Testnet. chainId/RPC are PLACEHOLDERS: verify against the
 *                      official Arc and Circle docs before deploying.
 *   arcMainnet         no defaults on purpose; every value must come from a verified .env
 *   robinhoodTestnet   Robinhood Chain Testnet, chain 46630 (Arbitrum Orbit, ETH gas)
 *   robinhoodMainnet   Robinhood Chain, chain 4663 (Arbitrum Orbit, ETH gas)
 *
 * Robinhood Chain values match the launchpad repo, which already deploys there. Blockscout
 * accepts any non-empty API key for `hardhat verify`.
 */

// The "0x..." placeholder from .env.example is ignored so local networks keep working.
const deployerKey = /^0x[0-9a-fA-F]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY ?? "")
  ? [process.env.DEPLOYER_PRIVATE_KEY as string]
  : [];

const BLOCKSCOUT_KEY = process.env.BLOCKSCOUT_API_KEY || "blockscout";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Shanghai (PUSH0) is supported on Arbitrum Orbit chains such as Robinhood Chain.
      // Cancun is avoided deliberately: TSTORE/MCOPY support varies across Orbit deployments.
      evmVersion: "shanghai",
    },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: Number(process.env.ARC_CHAIN_ID || 5042),
      accounts: deployerKey,
    },
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "http://unset.invalid",
      chainId: Number(process.env.ARC_MAINNET_CHAIN_ID || 0),
      accounts: deployerKey,
    },
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts: deployerKey,
    },
    robinhoodMainnet: {
      // On an ISP that filters rpc.mainnet.chain.robinhood.com, point this at a local
      // forwarder (see launchpad's `npm run rpc:proxy`, port 8545) or a dedicated provider.
      url: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts: deployerKey,
    },
  },
  etherscan: {
    apiKey: {
      arcTestnet: process.env.EXPLORER_API_KEY || "",
      arcMainnet: process.env.EXPLORER_API_KEY || "",
      robinhoodTestnet: BLOCKSCOUT_KEY,
      robinhoodMainnet: BLOCKSCOUT_KEY,
    },
    customChains: [
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
      {
        network: "robinhoodMainnet",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
};

export default config;

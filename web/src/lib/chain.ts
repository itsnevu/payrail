import { defineChain, type Chain } from "viem";
import { hardhat } from "viem/chains";
import deployment from "./deployment.json";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || deployment.chainId || 31337);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "";

export const PAYMENT_PROCESSOR_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS ||
  deployment.paymentProcessor) as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || deployment.usdc) as `0x${string}`;

export const USDC_DECIMALS = 6;

/**
 * Arc Testnet. The chainId and RPC values below are placeholders that MUST be
 * verified against the official Arc and Circle documentation before use.
 */
export const arcTestnet = defineChain({
  id: 5042,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: EXPLORER_URL
    ? { default: { name: "Arc Explorer", url: EXPLORER_URL } }
    : undefined,
  testnet: true,
});

export const chain: Chain =
  CHAIN_ID === hardhat.id ? { ...hardhat, rpcUrls: { default: { http: [RPC_URL] } } } : arcTestnet;


export const erc20Abi = [
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function txUrl(hash: string) {
  return EXPLORER_URL ? `${EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}` : "";
}
/**
 * PaymentProcessor ABI typed `as const` so viem/wagmi can infer event and function argument
 * types. Written inline on purpose (not `import ... .json`) because a JSON import loses
 * literal types. Matches contracts/contracts/PaymentProcessor.sol.
 */
export const paymentProcessorAbi = [
  {
    type: "function", name: "pay", stateMutability: "nonpayable",
    inputs: [
      { name: "salt", type: "bytes32" },
      { name: "merchant", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "invoiceKey", stateMutability: "pure",
    inputs: [
      { name: "salt", type: "bytes32" },
      { name: "merchant", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "isPaid", stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "getPayment", stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "amount", type: "uint96" },
          { name: "merchant", type: "address" },
          { name: "paidAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function", name: "usdc", stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event", name: "PaymentReceived", anonymous: false,
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "salt", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "InvalidToken", inputs: [] },
  { type: "error", name: "InvalidMerchant", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvoiceAlreadyPaid", inputs: [{ name: "invoiceId", type: "bytes32" }] },
] as const;

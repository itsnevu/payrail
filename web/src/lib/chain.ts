/**
 * ABIs and token constants. Chain selection lives in ./chains.ts: import `CHAINS`,
 * `getChain`, `DEFAULT_CHAIN_ID` and `txUrl` from there. Every invoice carries its own
 * `chainId`, so nothing here assumes a single network any more.
 */
export { CHAINS, CHAIN_IDS, DEFAULT_CHAIN, DEFAULT_CHAIN_ID, getChain, requireChain, chainName, txUrl, addressUrl } from "./chains";
export type { ChainConfig, ChainKey } from "./chains";

export const USDC_DECIMALS = 6;

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

import { defineChain, type Address, type Chain } from "viem";
import { hardhat } from "viem/chains";
import deployments from "./deployments.json";

/**
 * Every network Payrail can run on, in one place. Payrail is a Robinhood Chain product:
 * mainnet (4663) is the live network, the testnet (46630) is for rehearsals, and hardhat
 * (31337) for local development.
 *
 * An invoice is pinned to one chain at creation (`Invoice.chainId`). The buyer pays on that
 * chain, the backend verifies on that chain, and the indexer scans each enabled chain on its
 * own cursor. Nothing else in the app should hard-code a chain id.
 *
 * Which chains are *enabled* is decided by `NEXT_PUBLIC_CHAINS` (comma-separated ids). When
 * it is unset, every chain that has a PaymentProcessor deployment (from `deployments.json`
 * or the per-chain env overrides) is enabled.
 *
 * RPC split:
 *   - `serverRpc`  is what the backend (verify, indexer, the /api/rpc relay) talks to.
 *   - `browserRpc` is what wagmi and the wallet talk to. For Robinhood Chain it defaults to
 *     the same-origin relay `/api/rpc/<chainId>` because rpc.mainnet.chain.robinhood.com is
 *     content-filtered by Indonesian ISPs; the relay forwards from the server instead.
 */

export type ChainKey = "hardhat" | "robinhoodMainnet" | "robinhoodTestnet";

export type ChainConfig = {
  key: ChainKey;
  id: number;
  name: string;
  /** Short label for compact UI (badges, CSV). */
  short: string;
  chain: Chain;
  serverRpc: string;
  browserRpc: string;
  explorerUrl: string;
  paymentProcessor?: Address;
  usdc?: Address;
  testnet: boolean;
  /** True when the public RPC is known to be blocked for some users and the relay is preferred. */
  relayByDefault: boolean;
};

type DeploymentRecord = { network: string; chainId: number; usdc: string; paymentProcessor: string; deployedAt: string };
const DEPLOYMENTS = deployments as Record<string, DeploymentRecord | undefined>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Same-origin relay URL for a chain. Absolute so it also works during SSR hydration. */
function relayUrl(chainId: number) {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_URL;
  return `${origin.replace(/\/$/, "")}/api/rpc/${chainId}`;
}

function addr(v: string | undefined): Address | undefined {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined;
}

// Next.js only inlines NEXT_PUBLIC_* vars that are referenced literally, so every chain's
// overrides are spelled out here instead of built from a template string.
const ENV = {
  31337: {
    rpc: process.env.RPC_URL_31337,
    browserRpc: process.env.NEXT_PUBLIC_RPC_URL_31337,
    explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_31337,
    pp: process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_31337,
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_31337,
  },
  4663: {
    rpc: process.env.RPC_URL_4663,
    browserRpc: process.env.NEXT_PUBLIC_RPC_URL_4663,
    explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_4663,
    pp: process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_4663,
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_4663,
  },
  46630: {
    rpc: process.env.RPC_URL_46630,
    browserRpc: process.env.NEXT_PUBLIC_RPC_URL_46630,
    explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_46630,
    pp: process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_46630,
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_46630,
  },
} as const;

type Base = {
  key: ChainKey;
  id: keyof typeof ENV;
  name: string;
  short: string;
  publicRpc: string;
  explorerUrl: string;
  nativeCurrency: Chain["nativeCurrency"];
  testnet: boolean;
  relayByDefault: boolean;
};

const BASES: Base[] = [
  {
    key: "hardhat",
    id: 31337,
    name: "Hardhat (local)",
    short: "Local",
    publicRpc: "http://127.0.0.1:8545",
    explorerUrl: "",
    nativeCurrency: hardhat.nativeCurrency,
    testnet: true,
    relayByDefault: false,
  },
  {
    // Robinhood Chain: Arbitrum Orbit L2 settling to Ethereum, ETH gas. Values verified in
    // the launchpad repo (hardhat.config.ts, lib/wagmi-config.ts) which deploys there.
    key: "robinhoodMainnet",
    id: 4663,
    name: "Robinhood Chain",
    short: "Robinhood",
    publicRpc: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    testnet: false,
    relayByDefault: true,
  },
  {
    key: "robinhoodTestnet",
    id: 46630,
    name: "Robinhood Chain Testnet",
    short: "Robinhood test",
    publicRpc: "https://rpc.testnet.chain.robinhood.com",
    explorerUrl: "https://explorer.testnet.chain.robinhood.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    testnet: true,
    relayByDefault: true,
  },
];

function build(b: Base): ChainConfig {
  const env = ENV[b.id];
  const dep = DEPLOYMENTS[String(b.id)];
  const serverRpc = env.rpc || b.publicRpc;
  const browserRpc = env.browserRpc || (b.relayByDefault ? relayUrl(b.id) : serverRpc);
  const explorerUrl = (env.explorer ?? b.explorerUrl).replace(/\/$/, "");
  const chain = defineChain({
    id: b.id,
    name: b.name,
    nativeCurrency: b.nativeCurrency,
    rpcUrls: {
      // Relay first (works on filtered networks), public endpoint as the fallback the wallet
      // can keep when it adds the chain from here.
      default: { http: b.relayByDefault && browserRpc !== b.publicRpc ? [browserRpc, b.publicRpc] : [browserRpc] },
    },
    blockExplorers: explorerUrl ? { default: { name: "Explorer", url: explorerUrl } } : undefined,
    testnet: b.testnet,
  });
  return {
    key: b.key,
    id: b.id,
    name: b.name,
    short: b.short,
    chain,
    serverRpc,
    browserRpc,
    explorerUrl,
    paymentProcessor: addr(env.pp) ?? addr(dep?.paymentProcessor),
    usdc: addr(env.usdc) ?? addr(dep?.usdc),
    testnet: b.testnet,
    relayByDefault: b.relayByDefault,
  };
}

/** Every known chain, deployed or not. Keyed by chain id. */
export const ALL_CHAINS: Record<number, ChainConfig> = Object.fromEntries(BASES.map((b) => [b.id, build(b)]));

function parseEnabled(): number[] {
  const raw = process.env.NEXT_PUBLIC_CHAINS;
  if (raw && raw.trim()) {
    return raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((id) => Number.isInteger(id) && ALL_CHAINS[id]);
  }
  return Object.values(ALL_CHAINS)
    .filter((c) => c.paymentProcessor && c.usdc)
    .map((c) => c.id);
}

/**
 * Chains the app offers, in display order. Never empty: with nothing deployed the local
 * hardhat chain is kept so the dev flow still boots.
 */
export const CHAINS: ChainConfig[] = (() => {
  const ids = parseEnabled();
  const list = ids.length ? ids.map((id) => ALL_CHAINS[id]) : [ALL_CHAINS[31337]];
  return list;
})();

export const CHAIN_IDS: number[] = CHAINS.map((c) => c.id);

export const DEFAULT_CHAIN_ID: number = (() => {
  const want = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID);
  return CHAIN_IDS.includes(want) ? want : CHAIN_IDS[0];
})();

export const DEFAULT_CHAIN: ChainConfig = ALL_CHAINS[DEFAULT_CHAIN_ID];

/** Enabled chain by id, or undefined when the app does not offer it. */
export function getChain(chainId: number | undefined | null): ChainConfig | undefined {
  if (chainId == null) return undefined;
  return CHAIN_IDS.includes(chainId) ? ALL_CHAINS[chainId] : undefined;
}

/** Like getChain, but throws with a clear message. For server code paths. */
export function requireChain(chainId: number): ChainConfig & { paymentProcessor: Address; usdc: Address } {
  const c = getChain(chainId);
  if (!c) throw new Error(`chain ${chainId} is not enabled (NEXT_PUBLIC_CHAINS=${CHAIN_IDS.join(",")})`);
  if (!c.paymentProcessor || !c.usdc) {
    throw new Error(`chain ${chainId} (${c.name}) has no PaymentProcessor/USDC address; deploy first or set NEXT_PUBLIC_*_ADDRESS_${chainId}`);
  }
  return c as ChainConfig & { paymentProcessor: Address; usdc: Address };
}

export function chainName(chainId: number | undefined | null): string {
  return (chainId != null && ALL_CHAINS[chainId]?.name) || (chainId != null ? `chain ${chainId}` : "unknown network");
}

export function txUrl(chainId: number | undefined | null, hash: string): string {
  const c = chainId != null ? ALL_CHAINS[chainId] : undefined;
  return c?.explorerUrl ? `${c.explorerUrl}/tx/${hash}` : "";
}

export function addressUrl(chainId: number | undefined | null, address: string): string {
  const c = chainId != null ? ALL_CHAINS[chainId] : undefined;
  return c?.explorerUrl ? `${c.explorerUrl}/address/${address}` : "";
}

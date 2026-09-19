import { NextResponse } from "next/server";
import { CHAINS, DEFAULT_CHAIN_ID } from "@/lib/chains";

export const dynamic = "force-dynamic";

/**
 * GET /api/chains: the networks this deployment accepts invoices on, with the contract
 * addresses a wallet or script needs to pay without the UI. Server RPC URLs are not exposed.
 */
export async function GET() {
  return NextResponse.json({
    default: DEFAULT_CHAIN_ID,
    chains: CHAINS.map((c) => ({
      chainId: c.id,
      name: c.name,
      testnet: c.testnet,
      explorerUrl: c.explorerUrl || null,
      paymentProcessor: c.paymentProcessor ?? null,
      usdc: c.usdc ?? null,
      rpc: `/api/rpc/${c.id}`,
    })),
  });
}

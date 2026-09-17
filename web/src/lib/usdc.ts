import { formatUnits, parseUnits, keccak256, toBytes, encodeAbiParameters, type Address } from "viem";
import { USDC_DECIMALS } from "./chain";

/** "25.5" -> 25500000n */
export function toUnits(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/** 25500000n | "25500000" -> "25.50" */
export function formatUsdc(units: bigint | string): string {
  const n = Number(formatUnits(BigInt(units), USDC_DECIMALS));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/**
 * invoice.id (cuid) -> the 32-byte salt passed to PaymentProcessor.pay().
 * The cuid is random, so its hash is unguessable and unique per invoice.
 */
export function toSalt(invoiceDbId: string): `0x${string}` {
  return keccak256(toBytes(invoiceDbId));
}

/**
 * Offchain mirror of PaymentProcessor.invoiceKey:
 *   keccak256(abi.encode(salt, merchant, amount))
 * Binding merchant and amount into the key is what makes a wrong-terms payment land on a
 * different key instead of locking the real invoice.
 */
export function toOnchainId(invoiceDbId: string, merchant: Address, amountUnits: bigint): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
      [toSalt(invoiceDbId), merchant, amountUnits],
    ),
  );
}

export function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

// BigInt (blockNumber) cannot be JSON.stringify-ed, convert to string
export function serialize<T>(rows: T[]): T[] {
  return JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

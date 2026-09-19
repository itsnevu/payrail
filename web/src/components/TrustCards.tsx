"use client";

import { useState } from "react";

/**
 * The three guarantees, each with the line of code that makes it true on the back. A card is a
 * button; click, tap or Enter flips it. The snippets are quoted from contracts/PaymentProcessor.sol
 * and web/src/lib/verify.ts, trimmed to the lines that matter.
 */
const CARDS = [
  {
    figure: "Matched onchain",
    note: "The backend re-validates merchant and amount from the PaymentReceived event, not from frontend input. Anything that does not match never becomes PAID.",
    file: "web/src/lib/verify.ts",
    code: `const ev = decodePaymentReceived(receipt.logs);
if (ev.merchant !== invoice.merchant.walletAddress) reject();
if (ev.amount !== invoice.amount)                    reject();
if (ev.invoiceId !== invoice.onchainId)              reject();
await markPaid(invoice.id, receipt.transactionHash);`,
  },
  {
    figure: "Funds never held",
    note: "PaymentProcessor forwards USDC straight to the merchant wallet inside the same transaction. The contract never holds anyone's balance.",
    file: "contracts/PaymentProcessor.sol",
    code: `function pay(bytes32 salt, address merchant, uint256 amount)
    external nonReentrant
{
    bytes32 invoiceId = invoiceKey(salt, merchant, amount);
    if (_payments[invoiceId].amount != 0) revert InvoiceAlreadyPaid(invoiceId);
    _payments[invoiceId] = Payment(msg.sender, uint96(amount), merchant, uint64(block.timestamp));
    usdc.safeTransferFrom(msg.sender, merchant, amount); // never address(this)
    emit PaymentReceived(invoiceId, salt, merchant, msg.sender, amount, block.timestamp);
}`,
  },
  {
    figure: "Once, and only once",
    note: "A paid invoice is rejected by the contract (InvoiceAlreadyPaid), and txHash is unique in the database. Verification is idempotent; a double payment can never be recorded twice.",
    file: "web/prisma/schema.prisma",
    code: `model Payment {
  id        String   @id @default(cuid())
  invoiceId String   @unique
  chainId   Int      // Robinhood Chain
  txHash    String   @unique
  payer     String
  amount    String
  paidAt    DateTime
}`,
  },
];

export default function TrustCards() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <ul className="lp-col lp-grid">
      {CARDS.map((c, i) => {
        const flipped = open === i;
        return (
          <li key={c.figure} className="lp-tile">
            <button
              type="button"
              className={`lp-flip${flipped ? " is-flipped" : ""}`}
              onClick={() => setOpen(flipped ? null : i)}
              aria-pressed={flipped}
              aria-label={`${c.figure}. ${flipped ? "Hide" : "Show"} the code behind it.`}
            >
              <span className="lp-flip-inner">
                <span className="lp-art lp-art-surface lp-art-stat lp-flip-face lp-flip-front">
                  <span className="lp-figure">{c.figure}</span>
                  <span className="lp-note">{c.note}</span>
                  <span className="lp-flip-hint">Show the code</span>
                </span>
                <span className="lp-art lp-art-surface lp-art-stat lp-flip-face lp-flip-back">
                  <span className="lp-flip-file">{c.file}</span>
                  <code className="lp-flip-code">{c.code}</code>
                  <span className="lp-flip-hint">Back</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

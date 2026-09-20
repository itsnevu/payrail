"use client";

import type { FormEvent } from "react";
import { shortAddr } from "@/lib/usdc";

/**
 * Centred card for a connected wallet that has no merchant record yet. One input, one button;
 * the address it will be registered under is printed so nothing is hidden.
 */
export default function RegisterMerchantCard({
  address,
  name,
  onNameChange,
  onSubmit,
}: {
  address: string;
  name: string;
  onNameChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="card mx-auto w-full max-w-md p-6 sm:p-8">
      <p className="font-mono text-[12px] tracking-[0.02em] text-ink-faint">One step</p>
      <h2 className="mt-2 text-[22px] leading-tight tracking-[-0.02em]">Register this wallet as a merchant</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
        Invoices you create are paid straight to this address. The name is what buyers see on the payment page.
      </p>
      <dl className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-field px-4 py-3">
        <dt className="text-[13px] text-ink-soft">Wallet</dt>
        <dd className="tnum font-mono text-[13px] text-ink" title={address}>
          {shortAddr(address)}
        </dd>
      </dl>
      <label htmlFor="merchant-name" className="label mt-5">
        Business or freelancer name
      </label>
      <input
        id="merchant-name"
        className="input"
        placeholder="Northwind Studio"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        autoComplete="organization"
        required
      />
      <button type="submit" className="btn-primary mt-4 w-full">
        Register
      </button>
    </form>
  );
}

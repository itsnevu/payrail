import { ArrowIcon } from "@/components/Icons";
import { shortAddr } from "@/lib/usdc";

/**
 * The deployment in five mono tiles, the same facts the docs repeat: chain id, contract, token, gas,
 * confirmations. Values are the live Robinhood Chain deployment (contracts/deployments/4663.json and
 * web/src/lib/chains.ts); the confirmation count is the example configuration (CONFIRMATIONS_4663=2).
 */
const EXPLORER = "https://robinhoodchain.blockscout.com";
const CONTRACT = "0xD591A0d397179dE0692d50f43AC450C6cDF9C66D";
const TOKEN = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export default function ChainStrip() {
  return (
    <div className="lp-on-field">
      <section className="lp-section lp-chain" aria-labelledby="chain-heading">
        <div className="lp-col lp-chain-head">
          <p className="lp-kicker">Built on Robinhood Chain</p>
          <h2 id="chain-heading" className="lp-small lp-muted max-w-md">
            An Arbitrum Orbit L2. These are the values the pay page and the indexer are configured with; the
            contract is public, and so is every payment through it.
          </h2>
        </div>
        <ul className="lp-col lp-chain-grid">
          <li className="lp-tile lp-chain-tile">
            <span className="lp-chain-label">Chain id</span>
            <span className="lp-chain-value tnum">4663</span>
            <span className="lp-chain-note">Robinhood Chain</span>
          </li>
          <li className="lp-tile lp-chain-tile">
            <span className="lp-chain-label">PaymentProcessor</span>
            <a
              href={`${EXPLORER}/address/${CONTRACT}`}
              target="_blank"
              rel="noreferrer"
              className="lp-chain-value lp-chain-link"
              aria-label={`PaymentProcessor contract ${CONTRACT} on Blockscout`}
              title={CONTRACT}
            >
              {shortAddr(CONTRACT)}
              <ArrowIcon className="h-3.5 w-3.5" />
            </a>
            <span className="lp-chain-note">Blockscout</span>
          </li>
          <li className="lp-tile lp-chain-tile">
            <span className="lp-chain-label">Token</span>
            <span className="lp-chain-value">USDG, 6 decimals</span>
            <span className="lp-chain-note" title={TOKEN}>
              {shortAddr(TOKEN)} · USDG (Global Dollar)
            </span>
          </li>
          <li className="lp-tile lp-chain-tile">
            <span className="lp-chain-label">Gas</span>
            <span className="lp-chain-value">ETH</span>
            <span className="lp-chain-note">paid by the buyer, approve then pay</span>
          </li>
          <li className="lp-tile lp-chain-tile">
            <span className="lp-chain-label">PAID after</span>
            <span className="lp-chain-value tnum">2 confirmations</span>
            <span className="lp-chain-note">CONFIRMATIONS_4663=2</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

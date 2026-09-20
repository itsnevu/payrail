import { LegalPage, type LegalSectionDef } from "@/components/legal/LegalPage";
import { A, Code, Ext, Li, Mono, Note, P, Term, Ul } from "@/components/legal/Prose";
import { CONTACT_EMAIL, LINKS } from "@/lib/links";

export const metadata = {
  title: "Terms: Payrail",
  description:
    "The terms for using payrail.tech: what Payrail is and is not, how PAID is decided, who is responsible for what, fees, beta status and liability.",
};

const UPDATED = "20 September 2026";
const CONTRACT = "0xD591A0d397179dE0692d50f43AC450C6cDF9C66D";
const TOKEN = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const EXPLORER = "https://robinhoodchain.blockscout.com";

const sections: LegalSectionDef[] = [
  {
    id: "what-payrail-is",
    title: "What Payrail is and is not",
    body: (
      <>
        <P>
          <Term>Payrail</Term> is reconciliation software. A merchant creates an invoice and shares a payment link. A
          buyer pays it from their own wallet by calling the <Code>PaymentProcessor</Code> contract on Robinhood Chain.
          The contract forwards the tokens straight to the merchant and emits a <Code>PaymentReceived</Code> event.
          Payrail reads that event and marks the invoice PAID. That is the whole service.
        </P>
        <P>
          Payrail is <Term>not</Term> a payment service provider, a bank, a money transmitter, an exchange, an escrow
          agent or a custodian. It never holds, routes, converts or controls funds. It does not issue the token you pay
          with and has no say over it.
        </P>
        <P>
          The app labels amounts <Term>USDC</Term>. On Robinhood Chain the token actually moved is <Term>USDG</Term>{" "}
          (Global Dollar, 6 decimals). Payrail makes no statement about the value, backing or redeemability of that
          token; those questions belong to its issuer.
        </P>
        <div className="grid gap-3 sm:grid-cols-2">
          <Mono label="PaymentProcessor · Robinhood Chain (4663)">{CONTRACT}</Mono>
          <Mono label="Token (USDG, 6 decimals)">{TOKEN}</Mono>
        </div>
        <P>
          These terms cover the hosted service at <Ext href="https://payrail.tech">payrail.tech</Ext>, including its API
          and its same-origin RPC relay. The contract at the address above is public infrastructure: it has no owner and
          nobody, including us, can change or switch it off. If you run your own copy of the software, you are its
          operator and these terms do not reach your users.
        </P>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and acceptable use",
    body: (
      <>
        <P>
          You may use Payrail if you are old enough to enter a contract where you live and if using blockchain software
          and stablecoins is lawful for you there. There are no accounts, passwords or identity checks: a wallet address
          is the only identity the service knows. That means we cannot check who you are, so the legality of what you
          invoice, sell or pay for is entirely on you.
        </P>
        <P>Do not use the service to</P>
        <Ul>
          <Li>invoice for goods, services or activity that is unlawful where you or your buyer are;</Li>
          <Li>
            create invoices that misrepresent who the merchant is, or send a payment link to someone as if it came from a
            merchant it did not;
          </Li>
          <Li>
            hammer the API or the RPC relay. The relay forwards only the JSON-RPC methods a wallet needs and rate-limits
            each IP address; working around that is misuse;
          </Li>
          <Li>probe, disrupt or overload the hosted service, or interfere with other people using it.</Li>
        </Ul>
        <P>
          We may block wallet addresses, IP addresses or individual invoices from the hosted service when we see misuse.
          Blocking applies to the website and API only. The contract cannot be told to refuse anyone, and funds already
          sent are already with the merchant.
        </P>
      </>
    ),
  },
  {
    id: "non-custodial",
    title: "Non-custodial nature and finality of blockchain transactions",
    body: (
      <>
        <P>
          When a buyer calls <Code>pay(salt, merchant, amount)</Code>, the contract calls{" "}
          <Code>safeTransferFrom(buyer, merchant, amount)</Code> in the same transaction. Tokens go from the buyer&apos;s
          wallet to the merchant&apos;s wallet and nowhere else. The contract&apos;s balance is zero, structurally: it has
          no owner, no pause, no withdraw and no upgrade path. Payrail never has access to anyone&apos;s funds.
        </P>
        <P>
          <Term>Blockchain transactions are final.</Term> Once a payment is confirmed on Robinhood Chain there is no
          mechanism, on chain or at Payrail, to reverse, freeze, redirect or refund it. If tokens are sent to the wrong
          address, in the wrong amount outside the app, or from a wallet you did not mean to use, they went wherever the
          transaction said. Refunds, if any, are a matter between merchant and buyer and happen outside Payrail.
        </P>
        <P>
          Gas on Robinhood Chain is paid in ETH. The buyer pays it for the <Code>approve</Code> and <Code>pay</Code>{" "}
          transactions. Gas is charged by the network whether or not a transaction succeeds.
        </P>
        <Note label="In one line">
          Nothing can be withdrawn from Payrail because nothing was ever there. What we cannot hold, we cannot return.
        </Note>
      </>
    ),
  },
  {
    id: "paid-semantics",
    title: "Invoice status and verification",
    body: (
      <>
        <P>
          An invoice is <Code>PENDING</Code>, <Code>PAID</Code>, <Code>CANCELLED</Code> or <Code>EXPIRED</Code>.{" "}
          <Term>PAID</Term> is set only when our backend has read a <Code>PaymentReceived</Code> event emitted by the
          contract address above, in a transaction receipt whose status is success, after the configured number of block
          confirmations, on the chain the invoice was created for, with the merchant address and the amount exactly
          equal to the invoice. Two routes lead there: the transaction hash the buyer&apos;s browser hands us after
          paying, and an indexer that scans the chain for events on its own. Both end in the same idempotent check.
        </P>
        <P>
          A buyer saying they paid, a screenshot, a transaction hash on its own, or a token transfer sent straight to the
          merchant&apos;s address without going through the contract does not make an invoice PAID. Until the event is
          verified the invoice is PENDING, however sincere the buyer.
        </P>
        <P>
          <Term>Exact match.</Term> The payment key is <Code>keccak256(salt, merchant, amount)</Code>. A payment for a
          different amount, or to a different merchant, has a different key and does not close the invoice. The merchant
          settles such payments by hand.
        </P>
        <P>
          <Term>PAID is not undone.</Term> If the chain reorganises deeper than the configured confirmations after we
          recorded a payment, the record stays. We accept that as the price of an append-only ledger.
        </P>
        <P>
          <Term>Cancel is a database action.</Term> Cancelling marks the invoice CANCELLED in our records and the pay page
          stops offering it. The contract does not know about cancellation: if someone still calls <Code>pay()</Code>{" "}
          with the same terms, the tokens reach the merchant and the invoice becomes PAID. The merchant refunds by hand
          if that is what they want.
        </P>
        <P>
          <Term>Due dates.</Term> A due date is optional. If one is set and passes, the app marks the still-unpaid invoice
          EXPIRED the next time it is read and the pay page refuses it. The contract has no notion of expiry, so a
          payment made with the original terms outside the app still becomes PAID.
        </P>
        <P>
          Verification depends on an RPC provider answering. If it is slow or down, a paid invoice shows PENDING for
          longer than it should, then catches up. The status in the dashboard is a cached view of the chain, and the
          chain wins whenever they disagree.
        </P>
      </>
    ),
  },
  {
    id: "merchant-responsibilities",
    title: "Merchant responsibilities",
    body: (
      <>
        <P>As a merchant you are responsible for</P>
        <Ul>
          <Li>
            <Term>the wallet address you register.</Term> The name is display only; the address is what the contract
            pays. An invoice under a wrong address is paid to the wrong address and cannot be reversed;
          </Li>
          <Li>
            <Term>what your invoices say.</Term> Description, amount, customer name and due date are yours. Payment links
            are public to anyone holding the URL, so do not put secrets in a description;
          </Li>
          <Li>
            <Term>delivering what you invoiced,</Term> and for handling refunds, disputes and chargeback-style requests
            with your buyer directly. Payrail has no dispute process because it has nothing to hold back;
          </Li>
          <Li>
            <Term>tax, invoicing rules and record-keeping</Term> where you operate. Payrail generates payment links and a
            CSV export; it does not produce tax invoices, apply taxes or discounts, or keep books for you;
          </Li>
          <Li>
            <Term>payments that do not match.</Term> Underpayments, overpayments and transfers sent outside the contract
            do not close an invoice. Reconciling those is manual and yours.
          </Li>
        </Ul>
        <Note label="No merchant login yet">
          There is no merchant authentication in this release. Anyone who knows your wallet address can create an
          invoice under your merchant name; the tokens from such an invoice still land in your wallet, not theirs. Look
          for invoices you did not create, treat the dashboard as an unauthenticated view of public records, and export
          the CSV regularly. It is your copy.
        </Note>
      </>
    ),
  },
  {
    id: "buyer-responsibilities",
    title: "Buyer responsibilities",
    body: (
      <>
        <P>As a buyer you are responsible for</P>
        <Ul>
          <Li>
            <Term>checking before you confirm.</Term> The pay page shows the merchant name, the destination wallet, the
            amount and the contract address, and your wallet shows what you are about to sign. If any of it looks wrong,
            stop and ask the merchant through a channel you already trust;
          </Li>
          <Li>
            <Term>the link you follow.</Term> Payment links are public. Payrail cannot tell whether the person who sent you
            a link is the merchant named on it. Confirm the wallet address with the merchant if the amount matters to you;
          </Li>
          <Li>
            <Term>your wallet, network and balances.</Term> Pay from a wallet you control, on Robinhood Chain (chain id
            4663), with enough USDG for the invoice and enough ETH for gas. Expect two transactions, <Code>approve</Code>{" "}
            then <Code>pay</Code>, or one if your existing allowance already covers the amount;
          </Li>
          <Li>
            <Term>paying through the contract.</Term> A plain token transfer to the merchant&apos;s address may well reach
            them, but it carries no invoice key and will not close the invoice. Only <Code>pay()</Code> with the exact
            terms does.
          </Li>
        </Ul>
        <P>
          Payrail cannot recover tokens sent to the wrong place, cannot speed up a transaction your wallet is holding, and
          cannot see anything about you beyond the public address that paid.
        </P>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: (
      <>
        <P>
          <Term>Payrail charges no fee.</Term> The contract takes no cut and has no fee parameter that could be turned
          on; the merchant receives exactly the amount on the invoice, in the same transaction the buyer sends it.
        </P>
        <P>
          The buyer pays <Term>network gas</Term> in ETH for each transaction they send. Gas goes to the network, not to
          Payrail or the merchant, and varies with network conditions. Your wallet, bridge or on-ramp may charge fees of
          their own; those are theirs, not ours.
        </P>
        <P>
          If the hosted service ever charges for anything, it will be written here before it applies. The deployed
          contract cannot be changed to charge one.
        </P>
      </>
    ),
  },
  {
    id: "beta",
    title: "Beta status, no audit, changes",
    body: (
      <>
        <P>
          Payrail is in <Term>beta</Term>. The contract has not been independently audited. It has unit tests, an attack
          replay against an earlier version and two internal review passes; none of that is a third-party audit, and we
          say so on every page. Size invoices accordingly. Do not run amounts through it that a bug would ruin you to
          lose.
        </P>
        <P>
          We may change the website, the API, the database schema, the confirmation count and any other parameter of the
          hosted service at any time, and we may deploy a new contract at a new address. A new address would be listed in
          the <A href="/docs/changelog">changelog</A> and used for new invoices; records already on chain are unaffected
          by anything we do.
        </P>
        <P>
          The documentation describes the software as built. Where the docs and the code disagree, the code is what runs.
          Read <A href="/docs/risks-and-limits">Risks and limits</A> and <A href="/docs/security">Security model</A>{" "}
          before relying on any of this.
        </P>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and limitation of liability",
    body: (
      <>
        <P>
          The service and the contract are provided <Term>as is</Term> and <Term>as available</Term>, without warranty of
          any kind, express or implied, including any warranty of merchantability, fitness for a particular purpose,
          uninterrupted or error-free operation, or that a PAID status is correct in every case.
        </P>
        <P>
          Nothing on this site is <Term>financial, investment, tax or legal advice</Term>. Whether to accept a stablecoin,
          which one, from whom, and how to account for it are your decisions.
        </P>
        <P>
          To the fullest extent the law allows, Payrail and the people who run it are not liable for any loss arising
          from: tokens sent to a wrong or mistyped address; wrong amounts; a compromised wallet or seed phrase; a chain
          reorganisation; an RPC or network outage; actions of the token issuer, including freezing an address; a bug in
          the contract, the website or a third-party wallet; or misuse of a payment link by someone other than the
          merchant. This includes indirect, incidental, special and consequential loss, and lost profit.
        </P>
        <P>
          Where liability cannot be excluded, it is limited to the amount you paid Payrail for the service in the twelve
          months before the claim. Payrail charges nothing, so that amount is zero. Some jurisdictions do not allow some
          of these exclusions; where they do not, they apply only as far as that law permits.
        </P>
      </>
    ),
  },
  {
    id: "termination",
    title: "Termination and availability",
    body: (
      <>
        <P>
          You can stop using Payrail whenever you like. There is no account to close; stop opening the site and you are
          done. Ask us at the address below if you want your merchant record and invoices removed.
        </P>
        <P>
          We may suspend, restrict or discontinue the hosted service, block an address or remove an invoice, with or
          without notice, when we think it necessary. Uptime is not guaranteed and the site may be unavailable for
          maintenance or reasons outside our control.
        </P>
        <P>
          <Term>The contract is not ours to switch off.</Term> It has no owner and no pause. It keeps accepting payments
          whether payrail.tech is up or not, and every verified payment remains readable on{" "}
          <Ext href={`${EXPLORER}/address/${CONTRACT}`}>Blockscout</Ext> without us. The one thing that would go away with
          the hosted service is the convenience: the dashboard, the links and the matching. Export your CSV; it is the
          record you keep.
        </P>
      </>
    ),
  },
  {
    id: "contact",
    title: "Governing terms and contact",
    body: (
      <>
        <P>
          These terms and the <A href={LINKS.privacy}>privacy notice</A> are the whole agreement between you and Payrail
          for the hosted service. If part of them turns out to be unenforceable, the rest still applies. Not enforcing a
          term once does not waive it. The English text is the one that counts if it is ever translated.
        </P>
        <P>
          Mandatory consumer protection law where you live applies regardless of anything written here, to the extent it
          cannot be excluded.
        </P>
        <P>
          Questions, disputes and security reports go to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink">
            {CONTACT_EMAIL}
          </a>
          . Tell us the invoice id or the transaction hash and we can look at the same chain data you can.
        </P>
      </>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      kind="Terms"
      title="Terms of service"
      lede={
        <>
          The rules for using payrail.tech and the contract it talks to. They are short because the software is: funds go
          straight from buyer to merchant, PAID comes from an onchain event, and there is nothing in the middle for us to
          hold, reverse or promise.
        </>
      }
      updated={UPDATED}
      sections={sections}
      sibling={{
        href: LINKS.privacy,
        label: "Privacy notice",
        blurb: "What the service stores, what it never collects, and what a public blockchain shows about you.",
      }}
    />
  );
}

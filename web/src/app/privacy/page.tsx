import { LegalPage, type LegalSectionDef } from "@/components/legal/LegalPage";
import { A, Code, DataTable, Ext, Li, Note, P, Term, Ul } from "@/components/legal/Prose";
import { CONTACT_EMAIL, LINKS } from "@/lib/links";

export const metadata = {
  title: "Privacy: Payrail",
  description:
    "What payrail.tech stores and why, what it never collects, how wallet addresses and public blockchains work, push notifications, the RPC relay, local storage and your rights.",
};

const UPDATED = "20 September 2026";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

const sections: LegalSectionDef[] = [
  {
    id: "summary",
    title: "Summary",
    body: (
      <>
        <P>
          Payrail has no accounts, no passwords and no email sign-up. A merchant is a wallet address and a display name.
          A buyer is whichever address paid. Everything below follows from that.
        </P>
        <Ul>
          <Li>
            <Term>We store</Term> the invoices merchants create, the merchant name and wallet address, and a copy of each
            verified payment (transaction hash, payer, amount, block). That is the data you asked us to reconcile.
          </Li>
          <Li>
            <Term>We do not collect</Term> names, emails, phone numbers, identity documents or analytics. There are no
            trackers and no advertising.
          </Li>
          <Li>
            <Term>The blockchain is public.</Term> Every payment is visible to anyone, forever, whether or not Payrail
            exists.
          </Li>
          <Li>
            <Term>Payment links are public</Term> to anyone who has the URL.
          </Li>
          <Li>
            <Term>Push notifications are opt-in.</Term> Turn them on and we keep a subscription for that browser; turn
            them off and it is deleted.
          </Li>
          <Li>
            <Term>The RPC relay sees your IP address</Term> so it can rate-limit, and keeps it in memory for about a
            minute. Beyond that: standard server logs.
          </Li>
        </Ul>
      </>
    ),
  },
  {
    id: "what-we-store",
    title: "What we store",
    body: (
      <>
        <P>
          The service keeps five kinds of records in its database. None of them contain a password, an email address or a
          legal name unless a merchant types one into a free-text field.
        </P>
        <DataTable
          caption="Data the service stores, why, and for how long"
          rows={[
            {
              data: "Merchant: display name and wallet address",
              why: "Shown on the pay page so the buyer knows who they are paying. The address is what the contract sends tokens to.",
              keep: "Until you ask us to remove it. There is no self-serve delete yet.",
            },
            {
              data: "Invoice: description, amount, customer name and due date if given, chain id, status, timestamps, onchain payment key",
              why: "It is the invoice. Without it there is nothing to match a payment against.",
              keep: "Kept as your history. Cancelling changes the status; it does not delete the row.",
            },
            {
              data: "Payment: transaction hash, payer address, amount, block number, paid-at time",
              why: "The proof behind PAID. It is a copy of what the chain already shows.",
              keep: "Kept with the invoice it closed.",
            },
            {
              data: "Push subscription: endpoint URL, encryption keys, browser user agent, merchant id",
              why: "To deliver an Invoice paid notification to the browser that asked for it.",
              keep: "Until you turn notifications off, or the endpoint stops accepting (404 or 410), at which point it is deleted.",
            },
            {
              data: "Indexer cursor: last scanned block per chain",
              why: "So the indexer resumes where it left off.",
              keep: "Not about you; kept as long as the service runs.",
            },
          ]}
        />
        <P>
          Two things live outside the database. The RPC relay keeps a per-IP token bucket in server memory and drops
          entries after about a minute of inactivity; it is never written to disk. The web server keeps standard request
          logs; see section 7.
        </P>
        <P>
          The <Term>customer name</Term> field is free text a merchant may fill in about their own customer. We store it
          because the merchant asked us to; the merchant is responsible for having the right to share it, and it is
          visible on the payment link only as part of the invoice the merchant chose to send.
        </P>
      </>
    ),
  },
  {
    id: "what-we-do-not-collect",
    title: "What we do not collect",
    body: (
      <>
        <Ul>
          <Li>
            <Term>No accounts, no passwords, no identity checks.</Term> Nothing to register, nothing to reset.
          </Li>
          <Li>
            <Term>No email, phone number or legal name</Term> from either merchants or buyers. Support is by email only
            because you write to us, not because we asked for your address.
          </Li>
          <Li>
            <Term>No analytics or tracking scripts.</Term> The site loads no third-party analytics, no advertising pixels
            and no session-recording tools. We have checked the code; if that ever changes, this section will change
            first.
          </Li>
          <Li>
            <Term>No cross-site tracking.</Term> The fonts are bundled with the site, so your browser does not contact a
            font service. No cookies are set by us. See section 8 for the small amount of local storage the app uses.
          </Li>
          <Li>
            <Term>No sale of data.</Term> We do not sell, rent or trade any of the records above.
          </Li>
        </Ul>
      </>
    ),
  },
  {
    id: "public-blockchains",
    title: "Wallet addresses and public blockchains",
    body: (
      <>
        <P>
          A wallet address is a pseudonym, not a name, but it is a persistent one. Every payment through the contract is
          a public record on Robinhood Chain: the merchant address, the payer address, the amount, the block time and the
          invoice key. Anyone can read it on <Ext href={EXPLORER}>Blockscout</Ext> or from any node, and nobody can
          delete it, not the merchant, not the buyer, not us.
        </P>
        <P>
          This means a buyer&apos;s address is permanently linked to the merchant they paid, and a merchant&apos;s address
          shows every invoice ever paid to it. If that matters to you, pay from or receive to an address you are willing
          to have associated with the other party. Payrail cannot make chain data private after the fact.
        </P>
        <P>
          The invoice key on chain is <Code>keccak256(salt, merchant, amount)</Code>. It does not contain the description
          or the customer name; those exist only in our database and on the payment link.
        </P>
      </>
    ),
  },
  {
    id: "payment-links",
    title: "Payment links are public",
    body: (
      <>
        <P>
          A payment link looks like <Code>payrail.tech/pay/&lt;id&gt;</Code>. The id is a random 25-character string
          that cannot be guessed, but once the link is shared it is not a secret: anyone who has it can open it and see
          the merchant name, the description, the customer name if one was entered, the amount and the merchant&apos;s
          wallet address. That is what a buyer needs to pay.
        </P>
        <P>
          The API behind the dashboard is unauthenticated in this release. The same information is readable through{" "}
          <Code>GET /api/invoices/:id</Code>, and the lists behind <Code>GET /api/merchants</Code> and{" "}
          <Code>GET /api/invoices</Code> are readable by anyone who calls them. Treat everything you put into an invoice
          as visible to your buyer and potentially to others.
        </P>
        <Note label="Practical rule">
          Do not put secrets, passwords, private notes or anything you would not print on a paper invoice into a
          description or a customer name.
        </Note>
      </>
    ),
  },
  {
    id: "push",
    title: "Push notifications",
    body: (
      <>
        <P>
          Notifications exist only when the operator has configured push keys; otherwise the button is hidden and nothing
          in this section applies. When they are available, <Term>Notify me when paid</Term> on the dashboard asks your
          browser for permission. Nothing is stored until you say yes.
        </P>
        <P>
          If you opt in, your browser creates a push subscription: an endpoint URL at your browser vendor&apos;s push
          service and two encryption keys. We store that subscription together with the merchant id it belongs to and
          the browser&apos;s user agent string, one row per browser or device.
        </P>
        <P>
          When an invoice for that merchant is verified, we send one message through the browser vendor&apos;s push
          service. Its content is the title <Code>Invoice paid</Code> and one line with the customer name or description
          and the amount. The message is encrypted to your browser&apos;s keys; the push service relays it without being
          able to read it.
        </P>
        <P>
          Turning notifications off with the same button deletes the subscription from our database and from your
          browser. If a push service reports the endpoint gone, we delete it as well.
        </P>
      </>
    ),
  },
  {
    id: "rpc-relay",
    title: "RPC relay and server logs",
    body: (
      <>
        <P>
          To read a balance or send a transaction, the browser has to talk to a Robinhood Chain node. Payrail points it at
          a same-origin relay, <Code>POST /api/rpc/4663</Code>, instead of the public endpoint directly, because that
          public endpoint is content-filtered by some Indonesian ISPs. The relay forwards your request to{" "}
          <Code>{PUBLIC_RPC}</Code> from our server and returns the answer untouched.
        </P>
        <P>
          In doing so the relay sees your <Term>IP address</Term>, the JSON-RPC method and its parameters: for example the
          address whose balance is being read, or a signed transaction being broadcast. It forwards only a fixed list of
          methods a wallet needs, caps request size and batch size, and rate-limits per IP with a token bucket held in
          server memory. That bucket is the only place the relay keeps your IP, and entries are dropped after about a
          minute of inactivity. Nothing from the relay is written to the database.
        </P>
        <P>
          The upstream node sees our server&apos;s IP, not yours. Your wallet extension or app may use its own RPC
          endpoint for some operations, and that traffic is governed by the wallet&apos;s policy, not this one.
        </P>
        <P>
          The web server keeps <Term>standard server logs</Term>: request path, time, response status, IP address and
          user agent. They are used to run the service and to spot abuse. The code sets no specific retention for them;
          they are rotated as part of ordinary server operation and are not used to build profiles.
        </P>
      </>
    ),
  },
  {
    id: "cookies-and-storage",
    title: "Cookies and local storage",
    body: (
      <>
        <P>
          Payrail sets <Term>no cookies</Term>. There is no login session to keep and no tracking identifier to plant.
          The app does keep a small amount of state in your browser&apos;s local storage, all of it about your own device:
        </P>
        <Ul>
          <Li>
            <Term>Wallet connection state.</Term> The wallet library the app uses (wagmi) remembers which connector you
            last used and the connected address and chain, so you do not have to reconnect on every page. This is written
            by the library under its own keys and lives only in your browser.
          </Li>
          <Li>
            <Term>WalletConnect session,</Term> when the operator has configured a WalletConnect project id. The
            WalletConnect library stores its pairing and session data in local storage as well.
          </Li>
          <Li>
            <Term>One preference flag,</Term> <Code>payrail-a2hs-dismissed</Code>, set when you dismiss the Add to Home
            Screen hint on the pay page so it does not come back.
          </Li>
          <Li>
            <Term>Service worker cache.</Term> In production the site registers a service worker that caches static
            assets, icons and the offline page so the app installs and opens without a connection. It never caches API
            responses or anything with invoice data.
          </Li>
        </Ul>
        <P>
          Clearing site data for payrail.tech in your browser removes all of it. Nothing in local storage is sent to us.
        </P>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third parties",
    body: (
      <>
        <P>Using Payrail involves a small number of other systems, each with its own policy.</P>
        <Ul>
          <Li>
            <Term>Robinhood Chain RPC.</Term> Our server forwards relay requests to the chain&apos;s public RPC endpoint.
            The operator of that endpoint sees requests from our server. The chain itself is public infrastructure.
          </Li>
          <Li>
            <Term>Blockscout.</Term> Links to transactions and the contract go to{" "}
            <Ext href={EXPLORER}>robinhoodchain.blockscout.com</Ext>. Following one is a visit to their site under their
            terms.
          </Li>
          <Li>
            <Term>Your wallet.</Term> The extension or app you connect sees every request to sign and every address you
            use. What it collects and where it sends it is between you and the wallet.
          </Li>
          <Li>
            <Term>WalletConnect,</Term> only when the operator has configured it. Pairing then goes through
            WalletConnect&apos;s relay, which sees the connection metadata needed to route messages between the site and
            your wallet.
          </Li>
          <Li>
            <Term>Browser push services.</Term> If you opt in to notifications, the encrypted message travels through
            your browser vendor&apos;s push service.
          </Li>
        </Ul>
        <P>
          We use no analytics vendor, no advertising network, no customer-data platform and no external font or script
          CDN. If the hosted service is moved to a different RPC provider, this list changes; the mechanics do not.
        </P>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and contact",
    body: (
      <>
        <P>
          Whatever the law where you live calls them, these are the things you can ask of us, and what we can actually do
          about each.
        </P>
        <Ul>
          <Li>
            <Term>Access.</Term> Ask what we hold for a wallet address and we will tell you. A merchant can already see
            most of it on the dashboard and take it away as a CSV export.
          </Li>
          <Li>
            <Term>Correction.</Term> A merchant display name can be changed by registering again from the same wallet.
            Invoice fields are fixed once created; create a new invoice and cancel the old one.
          </Li>
          <Li>
            <Term>Deletion.</Term> We can delete a merchant record, its invoices, its payment records and its push
            subscriptions from our database. Before deleting anything tied to a wallet address we will ask you to prove
            you control that address. Deleting invoices removes the reconciliation history that goes with them.
          </Li>
          <Li>
            <Term>What we cannot do.</Term> Remove anything from the blockchain, recall a notification already sent, or
            identify a buyer beyond the address that paid.
          </Li>
        </Ul>
        <P>
          Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink">
            {CONTACT_EMAIL}
          </a>{" "}
          for any of the above, for questions about this notice, or to report a security problem. Include the wallet
          address, invoice id or transaction hash the request is about.
        </P>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <>
        <P>
          This notice describes the software as it is built today. When the code changes in a way that affects what is
          stored or who sees it, this page changes with it and the date at the top moves. Larger changes are also noted
          in the <A href="/docs/changelog">changelog</A>.
        </P>
        <P>
          Continuing to use the service after a change means you accept the updated notice. If you do not, stop using the
          hosted service and ask us to remove your records; there is no account to close.
        </P>
      </>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      kind="Privacy"
      title="Privacy notice"
      lede={
        <>
          What payrail.tech stores, why, and for how long. The short version: a wallet address is the only identity the
          service knows, invoices and verified payments are the only records it keeps, and everything that happens on the
          chain is public by nature.
        </>
      }
      updated={UPDATED}
      sections={sections}
      sibling={{
        href: LINKS.terms,
        label: "Terms of service",
        blurb: "What Payrail is and is not, how PAID is decided, and who is responsible for what.",
      }}
    />
  );
}

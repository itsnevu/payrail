/**
 * Every outbound link and contact point on the site, in one place.
 *
 * Entries that are `null` have no destination yet: components that use them render nothing
 * rather than pointing at an empty page. Publishing the real handles is a one-line change here.
 */
export const LINKS = {
  /** No account exists yet. Set to the profile URL to show the icon. */
  x: null as string | null,
  telegram: null as string | null,
  docs: "/docs",
  blog: "/blog",
  whitepaper: "/whitepaper",
  // App pages:
  app: "/app",
  newInvoice: "/invoices/new",
  terms: "/terms",
  privacy: "/privacy",
} as const;

/** Address printed on the legal pages. Point it at a mailbox someone actually reads before launch. */
export const CONTACT_EMAIL = "support@payrail.app";

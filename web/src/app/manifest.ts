import type { MetadataRoute } from "next";
import { LINKS } from "@/lib/links";

/** Served at /manifest.webmanifest and linked from <head> by Next. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Payrail",
    short_name: "Payrail",
    description:
      "Create a USDG invoice, send a payment link, and let the onchain payment be matched to the right invoice.",
    // The installed app opens straight into the dashboard, not the marketing page.
    start_url: LINKS.app,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "en",
    categories: ["finance", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New invoice", url: LINKS.newInvoice, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Dashboard", url: LINKS.app, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import PwaRegister from "@/components/PwaRegister";
import Effects from "@/components/Effects";

const grotesk = Schibsted_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const TITLE = "Payrail: Know exactly which invoice got paid.";
const DESCRIPTION =
  "Create a USDC invoice, send a payment link, and let the onchain payment be matched to the right invoice. Automatic, with no funds ever held.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_APP_URL in production so shared links resolve absolutely.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
  applicationName: "Payrail",
  // PWA: manifest.ts serves /manifest.webmanifest; icons are pre-rendered PNGs in /public.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Payrail" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Payrail",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Lets the app paint under the notch / home indicator when installed.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <PwaRegister />
        <Effects />
      </body>
    </html>
  );
}

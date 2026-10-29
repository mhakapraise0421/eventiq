import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { IqLauncher } from "@/components/iq/iq-launcher";
import { iqEnabled } from "@/lib/iq/config";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6026D9" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 3,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "EventIQ — Discover, book and manage events in Zimbabwe",
    template: "%s · EventIQ",
  },
  description:
    "Discover concerts, festivals, nightlife, conferences and cultural events across Zimbabwe. Secure tickets, verified organizers and fast QR entry.",
  keywords: [
    "Zimbabwe events",
    "Harare events",
    "Bulawayo events",
    "tickets Zimbabwe",
    "EventIQ",
  ],
  applicationName: "EventIQ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventIQ",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "EventIQ — Live events across Zimbabwe",
    description:
      "Discover concerts, festivals, nightlife, conferences and cultural events across Zimbabwe.",
    type: "website",
    locale: "en_ZW",
    siteName: "EventIQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen bg-white font-sans text-ink-900 antialiased">
        <ServiceWorkerRegistration />
        <SiteHeader />
        <main className="min-h-[60vh]">{children}</main>
        <SiteFooter />
        <IqLauncher enabled={iqEnabled()} />
      </body>
    </html>
  );
}

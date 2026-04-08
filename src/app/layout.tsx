import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";

import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Parcel Deck",
  description: "A self-hosted household shipment board for OpenClaw-discovered packages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full`}
      lang="en"
    >
      <body className="min-h-full bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}

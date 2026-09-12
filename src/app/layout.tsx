import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Literata,
  Source_Serif_4,
} from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const display = Literata({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const ui = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FOLIO",
  description:
    "Ubaid’s private, local-first Kindle. Books stay on your device.",
  applicationName: "FOLIO",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FOLIO",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${ui.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

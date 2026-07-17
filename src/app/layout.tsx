import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import EdgePanel from "@/components/EdgePanel";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Now Nudge",
  description: "Location-aware PWA that sends nudges based on your proximity",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Now Nudge",
  },
};

export const viewport = {
  themeColor: "#317EFB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <EdgePanel />
      </body>
    </html>
  );
}

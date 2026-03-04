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

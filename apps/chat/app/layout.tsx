import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Müsait Chat",
  description: "AI Agent Monitoring Dashboard — Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} noise-overlay`}
        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

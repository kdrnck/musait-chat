import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
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
    <html lang="tr" className="light">
      <body
        className={`${poppins.variable} antialiased`}
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowProvider } from '@/components/providers/RainbowProvider';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Neovalend - Lending Protocol based on AAVE",
  description: "Lending Protocol based on AAVE Multi-asset lending protocol on NEO X",
  keywords: "DeFi, lending, USDT, A7A5, rebase, ethereum, ruble stablecoin, AAVE",
  openGraph: {
    title: "Neovalend - Lending Protocol based on AAVE",
    description: "Lending Protocol based on AAVE Multi-asset lending protocol on NEO X",
    type: "website",
    url: "https://neovalend.ru",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neovalend - Lending Protocol based on AAVE",
    description: "Lending Protocol based on AAVE Multi-asset lending protocol on NEO X",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <RainbowProvider>
          {children}
        </RainbowProvider>
      </body>
    </html>
  );
}
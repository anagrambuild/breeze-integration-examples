import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "./components/AppWalletProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Try Breeze",
  description: "Earning yield on Solana has never been easier.",
  openGraph: {
    title: "Try Breeze",
    description: "Earning yield on Solana has never been easier.",
    type: "website",
    siteName: "Breeze",
  },
  twitter: {
    card: "summary",
    title: "Try Breeze",
    description: "Earning yield on Solana has never been easier.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppWalletProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid rgba(227, 87, 213, 0.2)",
                color: "hsl(var(--foreground))",
              },
              classNames: {
                success: "!border-green-500/30",
                error: "!border-red-500/30",
              },
            }}
          />
        </AppWalletProvider>
      </body>
    </html>
  );
}

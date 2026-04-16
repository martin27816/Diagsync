import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Diagsync - Medical Diagnostic Operations",
  description: "Multi-role diagnostic operations system for medical labs",
  icons: {
    icon: "/diagsync-logo.png",
    shortcut: "/diagsync-logo.png",
    apple: "/diagsync-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

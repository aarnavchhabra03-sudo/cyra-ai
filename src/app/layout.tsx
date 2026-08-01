import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CYRA AI — Personalized Learning",
  description: "Tell CYRA what you want to learn and it will build the entire learning experience for you.",
  keywords: ["AI learning", "personalized education", "CYRA AI", "study assistant"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <Sidebar />
        <main
          className="flex-1 h-screen overflow-y-auto"
          style={{ marginLeft: 'var(--sidebar-w)' }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}

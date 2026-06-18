import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locksmith — Dependency review",
  description: "Put dependency changes on trial before they enter your lockfile.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header className="site-header"><Link className="brand" href="/"><span aria-hidden="true" className="mark">L</span>LOCKSMITH</Link><nav aria-label="Primary"><Link href="/review">Web review</Link><Link href="/terminal">Terminal</Link><a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></nav></header>{children}<footer><span>LOCKSMITH / QWEN AGENT SOCIETY</span><span>Dependency decisions, tied to state.</span></footer></body></html>;
}

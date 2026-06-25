import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locksmith — Dependency review",
  description: "Put dependency changes on trial before they enter your lockfile.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header className="site-header"><Link className="brand" href="/"><span aria-hidden="true" className="mark" />Locksmith</Link><nav aria-label="Primary"><Link href="/#product">Product</Link><Link href="/how-to">How to</Link><Link href="/terminal">Terminal</Link><Link href="/history">History</Link><Link href="/how-to#trust-model">Trust model</Link></nav><div className="header-actions"><Link className="header-cta" href="/review">Scan repository</Link></div></header>{children}<footer><span>LOCKSMITH / QWEN AGENT SOCIETY</span><span>Dependency decisions, tied to state.</span></footer></body></html>;
}

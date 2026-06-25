import type { Metadata } from "next";
import Header from "./components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locksmith — Dependency review",
  description: "Put dependency changes on trial before they enter your lockfile.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}<footer><span>LOCKSMITH / QWEN AGENT SOCIETY</span><span>Dependency decisions, tied to state.</span></footer></body></html>;
}

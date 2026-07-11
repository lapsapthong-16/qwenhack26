import type { Metadata } from "next";
import Header from "./components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locksmith — Dependency review",
  description: "Put dependency changes on trial before they enter your lockfile.",
  icons: {
    icon: "/assets/12_locksmith_logo.png",
    apple: "/assets/12_locksmith_logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}</body></html>;
}

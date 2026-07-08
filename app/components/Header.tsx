"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const nav = [
    ["/review", "Review"],
    ["/history", "History"],
  ] as const;

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span aria-hidden="true" className="mark" />
        Locksmith
      </Link>
      <nav aria-label="Primary">
        {nav.map(([href, label]) => <Link className={pathname === href || (pathname === "/" && href === "/review") ? "active" : ""} href={href} key={href}>{label}</Link>)}
      </nav>
    </header>
  );
}

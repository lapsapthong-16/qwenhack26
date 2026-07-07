"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const nav = [
    ["/review", "Review"],
    ["/history", "History"],
    ["/terminal", "Terminal"],
  ] as const;

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span aria-hidden="true" className="mark" />
        Locksmith
      </Link>
      {!isHome ? <nav aria-label="Primary">
        {nav.map(([href, label]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}>{label}</Link>)}
      </nav> : null}
      <div className="header-actions">
        <Link className={`header-cta ${pathname === "/review" ? "active" : ""}`} href="/review">Scan repository</Link>
      </div>
    </header>
  );
}

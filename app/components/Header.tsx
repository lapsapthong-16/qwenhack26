"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const isHome = usePathname() === "/";

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span aria-hidden="true" className="mark" />
        Locksmith
      </Link>
      {!isHome ? (
        <nav aria-label="Primary">
          <Link href="/history">History</Link>
        </nav>
      ) : null}
      <div className="header-actions">
        <Link className="header-cta" href="/review">Scan repository</Link>
      </div>
    </header>
  );
}

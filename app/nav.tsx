"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePoll } from "./use-poll";

/**
 * The count on "Needs you" is the whole point of the home screen: uploading is
 * occasional, approving is weekly, so the number that should be visible at all
 * times is how many drafts are waiting on a person.
 */
export function Nav() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<number | null>(null);

  usePoll(async () => {
    try {
      const res = await fetch("/api/review-queue");
      if (res.ok) setWaiting(((await res.json()) as { count: number }).count);
    } catch {
      /* the badge is a convenience; a failed poll should not surface */
    }
  }, 20000);

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="rail">
      <div className="brand">
        <div className="brand-name">Telegraph</div>
        <div className="brand-sub">Matter workspace</div>
      </div>
      <div className="nav">
        <Link href="/" data-active={active("/")}>
          Needs you
          {waiting ? <span className="count">{waiting}</span> : null}
        </Link>
        <Link href="/matters" data-active={active("/matters")}>
          Matters
        </Link>
      </div>
      <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid var(--rule-soft)" }}>
        <div style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.5 }}>
          Running locally. Case files never leave this machine except as an API
          call, and are deleted once processed.
        </div>
      </div>
    </nav>
  );
}

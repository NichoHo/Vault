"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* One escape hatch on every route except home. Lives in the root layout so new
   pages inherit it. Always points at "/" rather than history.back(), because a
   predictable destination beats one that depends on how you arrived. */
export default function BackLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link
      href="/"
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
    >
      <span aria-hidden="true">←</span> Back to marketplace
    </Link>
  );
}

import Link from "next/link";
import CategoryChips from "@/components/CategoryChips";
import ListingCard from "@/components/ListingCard";
import { fetchListings } from "@/lib/api";

export default async function Home() {
  const { items } = await fetchListings({ limit: 24 });
  return (
    <div className="flex flex-col gap-8">
      {/* Hero — the "stranger understands in 5 minutes" pitch */}
      <section className="rule-torii rounded-[8px] border border-sumi-20 bg-surface p-6 sm:p-8">
        <h1 className="max-w-xl text-pretty text-2xl font-bold leading-tight sm:text-[32px] sm:leading-[1.15]">
          A marketplace built from the hard parts up.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-sumi-60">
          Vault is a compact C2C marketplace with three things built from scratch: a self-hosted
          OAuth&nbsp;2.0 / OIDC identity provider, escrow checkout on a double-entry ledger, and an
          AI listing assistant.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-indigo/10 px-3 py-1 font-medium text-indigo">
            OIDC + TOTP MFA
          </span>
          <span className="rounded-full bg-moss/10 px-3 py-1 font-medium text-moss">
            Escrow ledger
          </span>
          <span className="rounded-full bg-kohaku/10 px-3 py-1 font-medium text-kohaku">
            AI-assisted selling
          </span>
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            href="/search"
            className="rounded-[6px] border border-sumi-20 px-4 py-2 text-sm font-medium transition-colors hover:border-sumi-40"
          >
            Browse everything
          </Link>
          <Link
            href="/sell"
            className="rounded-[6px] bg-torii px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sell an item
          </Link>
        </div>
      </section>

      <CategoryChips />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Fresh listings</h2>
          <Link href="/search" className="text-sm text-indigo transition-colors hover:text-ink">
            View all →
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-sumi-20 p-8 text-center text-sm text-sumi-60">
            Nothing here yet. Run <code className="rounded bg-sumi-10 px-1">make seed</code> or be
            the first to sell something.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

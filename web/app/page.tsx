import Link from "next/link";
import CategoryChips from "@/components/CategoryChips";
import ListingCard from "@/components/ListingCard";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import Reveal from "@/components/motion/Reveal";
import StaggerGrid from "@/components/motion/StaggerGrid";
import { fetchListings, type Listing } from "@/lib/api";

export default async function Home() {
  // A listings outage shouldn't take the whole storefront down. Degrade instead
  // of throwing a 500, but keep "service unreachable" distinct from "catalogue
  // is empty", because showing the seed hint during an outage reads as data loss.
  let items: Listing[] = [];
  let unreachable = false;
  try {
    ({ items } = await fetchListings({ limit: 24 }));
  } catch {
    unreachable = true;
  }
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {/* Hero: the "stranger understands in 5 minutes" pitch */}
      <Reveal mode="mount">
        <section className="wash-accent rounded-panel border border-line p-8 sm:p-12">
          <h1 className="max-w-2xl text-pretty text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            A marketplace built from the hard parts up.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Vault is a small marketplace for buying and selling secondhand things. The parts most
            projects hand to a library are written from scratch here: the sign-in, the escrow that
            holds a buyer&apos;s money until their item arrives, and the assistant that drafts a
            listing from a photo.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-primary-tint px-3 py-1 text-primary">OIDC + TOTP MFA</span>
            <span className="rounded-full bg-success-tint px-3 py-1 text-success">Escrow ledger</span>
            <span className="rounded-full bg-copilot-tint px-3 py-1 text-copilot">
              AI-assisted selling
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rounded-control border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-fill"
            >
              Browse everything
            </Link>
            <Link
              href="/sell"
              className="rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-on-solid shadow-sm transition-colors hover:bg-primary-strong"
            >
              Sell an item
            </Link>
          </div>
        </section>
      </Reveal>

      <CategoryChips />

      <Reveal>
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Fresh listings</h2>
            <Link
              href="/search"
              className="text-sm font-medium text-primary transition-colors hover:text-primary-strong"
            >
              View all →
            </Link>
          </div>
          {unreachable ? (
            <ServiceUnavailable
              service="marketplace"
              detail="Listings are temporarily unavailable. That is a connection problem, not an empty catalogue, so try again in a moment."
            />
          ) : items.length === 0 ? (
            <div className="rounded-card border border-line bg-surface p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing here yet. Run{" "}
                <code className="rounded bg-fill px-1.5 py-0.5 font-mono text-[0.8em] text-ink-2">
                  make seed
                </code>{" "}
                or be the first to sell something.
              </p>
            </div>
          ) : (
            <StaggerGrid className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
              {items.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </StaggerGrid>
          )}
        </section>
      </Reveal>
    </div>
  );
}

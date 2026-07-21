import ListingCard from "@/components/ListingCard";
import { fetchListings } from "@/lib/api";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const { items } = await fetchListings({ q: sp.q, category: sp.category, limit: 48 });
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        {sp.q ? `Results for “${sp.q}”` : "All listings"}
        <span className="ml-2 text-sm font-normal text-sumi-40">{items.length} found</span>
      </h1>
      {items.length === 0 ? (
        <p className="text-sumi-60">No listings match. Try another search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}

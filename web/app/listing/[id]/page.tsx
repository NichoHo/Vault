import { notFound, redirect } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { fetchCategories, fetchListing, marketPost, yen } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

async function buyNow(formData: FormData) {
  "use server";
  const token = await getToken();
  const listingID = String(formData.get("listing_id"));
  if (!token) redirect(`/auth/start?next=/listing/${listingID}`);
  const resp = await marketPost(token, "/orders", { listing_id: listingID });
  if (!resp.ok) redirect(`/listing/${listingID}?error=unavailable`);
  const order = (await resp.json()) as { id: string };
  redirect(`/checkout/${order.id}`);
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const [listing, categories, user, sp] = await Promise.all([
    fetchListing(id),
    fetchCategories(),
    getUser(),
    searchParams,
  ]);
  if (!listing) notFound();
  const category = categories.find((c) => c.id === listing.category_id);
  const isOwner = user?.sub === listing.seller_id;
  const buyable = listing.status === "active" && !isOwner;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="overflow-hidden rounded-[8px] border border-sumi-20 bg-sumi-10 md:sticky md:top-20 md:self-start">
        <img
          src={listing.image_url || "https://picsum.photos/seed/vault/800/600"}
          alt={listing.title}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={listing.status} />
          {category ? <span className="text-xs text-sumi-40">{category.name}</span> : null}
        </div>
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <p className="money mt-2 text-3xl font-bold">{yen(listing.price_minor)}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-sumi-60">
          {listing.description || "No description."}
        </p>
        <div className="mt-6 rounded-[8px] border border-sumi-20 bg-surface p-4 text-sm">
          <p className="text-sumi-40">Seller</p>
          <p className="font-medium">
            {isOwner ? "You" : listing.seller_id.slice(0, 8) + "…"}
          </p>
        </div>
        {sp.error === "unavailable" ? (
          <p className="mt-4 rounded-[6px] bg-kohaku/10 px-3 py-2 text-sm text-kohaku">
            Someone else got there first — this listing is no longer available.
          </p>
        ) : null}
        {buyable ? (
          <form action={buyNow}>
            <input type="hidden" name="listing_id" value={listing.id} />
            <button
              type="submit"
              className="mt-6 w-full rounded-[6px] bg-torii px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              Buy — funds held in escrow
            </button>
            <p className="mt-2 text-center text-xs text-sumi-40">
              Your payment is held on a double-entry ledger and released to the seller only
              after you confirm receipt.
            </p>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-sumi-40">
            {isOwner
              ? "This is your listing."
              : listing.status === "sold"
                ? "This item has been sold."
                : listing.status === "reserved"
                  ? "This item is reserved by another buyer."
                  : "This item is not for sale right now."}
          </p>
        )}
      </div>
    </div>
  );
}

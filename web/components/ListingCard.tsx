import Link from "next/link";
import { yen, type Listing } from "@/lib/api";

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block overflow-hidden rounded-[8px] border border-sumi-20 bg-surface transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-sumi-40"
    >
      <div className="aspect-[4/3] overflow-hidden bg-sumi-10">
        {/* plain <img>: no image optimizer in the container; picsum seeds the demo */}
        <img
          src={listing.image_url || "https://picsum.photos/seed/vault/800/600"}
          alt={listing.title}
          width={800}
          height={600}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <div className="p-3">
        <p className="truncate text-sm leading-5 text-ink">{listing.title}</p>
        <p className="money mt-1 text-base font-bold">{yen(listing.price_minor)}</p>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { fetchCategories } from "@/lib/api";

// Horizontal category row for the home page — links into search filters.
export default async function CategoryChips() {
  const categories = await fetchCategories();
  if (categories.length === 0) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/search?category=${c.id}`}
          className="shrink-0 rounded-full border border-sumi-20 bg-surface px-3.5 py-1.5 text-sm text-sumi-60 transition-colors hover:border-indigo hover:text-indigo"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

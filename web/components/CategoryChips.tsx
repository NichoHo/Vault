import Link from "next/link";
import { fetchCategories } from "@/lib/api";

// Horizontal category row for the home page. Links into search filters.
export default async function CategoryChips() {
  const categories = await fetchCategories();
  if (categories.length === 0) return null;
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/search?category=${c.id}`}
          className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:bg-accent-tint hover:text-accent"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

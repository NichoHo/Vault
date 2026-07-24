import { redirect } from "next/navigation";
import { fetchCategories } from "@/lib/api";
import { getUser } from "@/lib/auth";
import SellForm from "./SellForm";

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/auth/start?next=/sell");
  const [categories, sp] = await Promise.all([fetchCategories(), searchParams]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1.5 text-xl font-bold tracking-tight text-ink">Sell an item</h1>
      <p className="mb-5 text-sm leading-6 text-muted">
        Paste a photo URL and let the assistant draft the listing. Fields it filled in keep a{" "}
        <span className="border-l-4 border-accent pl-1.5">coloured edge</span> until you edit
        them.
      </p>
      <SellForm categories={categories} hadError={sp.error === "1"} />
    </div>
  );
}

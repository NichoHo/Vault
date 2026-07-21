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
      <h1 className="mb-1 text-xl font-bold">Sell an item</h1>
      <p className="mb-4 text-sm text-sumi-40">
        Paste a photo URL and let the assistant draft your listing — fields with an{" "}
        <span className="border-l-4 border-indigo pl-1">indigo edge</span> are AI-suggested
        until you edit them.
      </p>
      <SellForm categories={categories} hadError={sp.error === "1"} />
    </div>
  );
}

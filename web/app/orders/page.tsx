import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { fetchOrders, yen } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const token = await getToken();
  if (!token) redirect("/auth/start?next=/orders");
  const sp = await searchParams;
  const role = sp.role === "seller" ? "seller" : "buyer";
  const orders = await fetchOrders(token, role);

  const tab = (r: string, label: string) => (
    <Link
      href={`/orders?role=${r}`}
      className={`rounded-[6px] px-3 py-1.5 text-sm ${
        role === r ? "bg-indigo text-white" : "border border-sumi-20"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Orders</h1>
      <div className="mb-4 flex gap-2">
        {tab("buyer", "Purchases")}
        {tab("seller", "Sales")}
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-sumi-60">
          Nothing here yet. {role === "buyer" ? "Go buy something nice." : "List something for sale."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 rounded-[8px] border border-sumi-20 bg-surface p-3 hover:border-sumi-40"
              >
                <img
                  src={o.listing_image || "https://picsum.photos/seed/vault/160/120"}
                  alt=""
                  className="h-14 w-18 rounded-[6px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.listing_title}</p>
                  <p className="text-xs text-sumi-40">
                    {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="money text-sm font-bold">{yen(o.price_minor)}</span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { fetchOrder, fetchWallet, marketPost, payDeposit, yen } from "@/lib/api";
import { getToken } from "@/lib/auth";

async function payAction(formData: FormData) {
  "use server";
  const token = await getToken();
  const orderID = String(formData.get("order_id"));
  if (!token) redirect("/auth/start");
  const resp = await marketPost(token, `/orders/${orderID}/pay`);
  if (resp.status === 402) redirect(`/checkout/${orderID}?error=funds`);
  if (!resp.ok) redirect(`/checkout/${orderID}?error=pay`);
  redirect(`/orders/${orderID}`);
}

async function topUpAction(formData: FormData) {
  "use server";
  const token = await getToken();
  const orderID = String(formData.get("order_id"));
  if (!token) redirect("/auth/start");
  await payDeposit(token, 50_000);
  redirect(`/checkout/${orderID}`);
}

async function cancelAction(formData: FormData) {
  "use server";
  const token = await getToken();
  const orderID = String(formData.get("order_id"));
  if (!token) redirect("/auth/start");
  await marketPost(token, `/orders/${orderID}/cancel`);
  redirect("/orders");
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const token = await getToken();
  const { orderId } = await params;
  if (!token) redirect(`/auth/start?next=/checkout/${orderId}`);
  const [order, wallet, sp] = await Promise.all([
    fetchOrder(token, orderId),
    fetchWallet(token),
    searchParams,
  ]);
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/orders/${order.id}`);
  const balance = wallet?.balance_minor ?? 0;
  const short = balance < order.price_minor;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold">Checkout</h1>
      <div className="rounded-[8px] border border-sumi-20 bg-surface p-4">
        <div className="flex items-center gap-3">
          <img
            src={order.listing_image || "https://picsum.photos/seed/vault/160/120"}
            alt=""
            className="h-16 w-20 rounded-[6px] object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{order.listing_title}</p>
            <p className="money text-lg font-bold">{yen(order.price_minor)}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-1 border-t border-sumi-20 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-sumi-60">Your wallet</dt>
            <dd className={`money ${short ? "text-torii" : ""}`}>{yen(balance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sumi-60">Held in escrow until you confirm receipt</dt>
            <dd className="money">{yen(order.price_minor)}</dd>
          </div>
        </dl>
      </div>

      {sp.error === "funds" || short ? (
        <div className="mt-4 rounded-[6px] bg-torii/10 px-3 py-2 text-sm text-torii">
          Not enough funds in your wallet.
          <form action={topUpAction} className="mt-2">
            <input type="hidden" name="order_id" value={order.id} />
            <button className="rounded-[6px] bg-indigo px-3 py-1.5 text-white">
              Add ¥50,000 demo funds
            </button>
          </form>
        </div>
      ) : null}
      {sp.error === "pay" ? (
        <p className="mt-4 rounded-[6px] bg-torii/10 px-3 py-2 text-sm text-torii">
          Payment failed. Try again.
        </p>
      ) : null}

      <form action={payAction} className="mt-4">
        <input type="hidden" name="order_id" value={order.id} />
        <button
          type="submit"
          disabled={short}
          className="w-full rounded-[6px] bg-torii px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          Pay {yen(order.price_minor)}
        </button>
      </form>
      <form action={cancelAction} className="mt-2">
        <input type="hidden" name="order_id" value={order.id} />
        <button className="w-full rounded-[6px] border border-sumi-20 px-4 py-2 text-sm">
          Cancel order
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-sumi-40">
        The reservation holds this item for 15 minutes.
      </p>
    </div>
  );
}

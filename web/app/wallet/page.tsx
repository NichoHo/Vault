import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchWallet, payDeposit, yen } from "@/lib/api";
import { getToken } from "@/lib/auth";

async function topUpAction() {
  "use server";
  const token = await getToken();
  if (!token) redirect("/auth/start");
  await payDeposit(token, 50_000);
  redirect("/wallet");
}

const kindLabel: Record<string, string> = {
  deposit: "Deposit",
  escrow_fund: "Payment to escrow",
  escrow_release: "Sale proceeds",
  escrow_refund: "Refund",
  fee: "Platform fee",
};

export default async function WalletPage() {
  const token = await getToken();
  if (!token) redirect("/auth/start?next=/wallet");
  const wallet = await fetchWallet(token);
  if (!wallet) redirect("/auth/start?next=/wallet");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold">Wallet</h1>
      <div className="rounded-[8px] border border-sumi-20 bg-surface p-6 text-center">
        <p className="text-sm text-sumi-60">Balance</p>
        <p className="money text-4xl font-bold">{yen(wallet.balance_minor)}</p>
        <form action={topUpAction} className="mt-4">
          <button className="rounded-[6px] bg-indigo px-4 py-2 text-sm font-medium text-white">
            Add ¥50,000 demo funds
          </button>
        </form>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold text-sumi-60">
        Ledger entries — your side of every transfer
      </h2>
      {wallet.entries.length === 0 ? (
        <p className="text-sm text-sumi-60">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-sumi-20 rounded-[8px] border border-sumi-20 bg-surface">
          {wallet.entries.map((e, i) => {
            const orderID = e.reference.startsWith("order:") ? e.reference.slice(6) : null;
            return (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p>{kindLabel[e.kind] ?? e.kind}</p>
                  <p className="text-xs text-sumi-40">
                    {new Date(e.created_at).toLocaleString()}
                    {orderID ? (
                      <>
                        {" · "}
                        <Link href={`/orders/${orderID}`} className="text-indigo underline">
                          order
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <span
                  className={`money font-medium ${e.amount_minor > 0 ? "text-moss" : "text-torii"}`}
                >
                  {e.amount_minor > 0 ? "+" : ""}
                  {yen(e.amount_minor).replace("¥-", "-¥")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

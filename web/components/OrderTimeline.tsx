import type { Order } from "@/lib/api";

const steps = [
  { key: "created_at", label: "Order placed" },
  { key: "funded_at", label: "Payment in escrow" },
  { key: "shipped_at", label: "Shipped" },
  { key: "completed_at", label: "Completed — escrow released" },
] as const;

export default function OrderTimeline({ order }: { order: Order }) {
  const dead = order.status === "cancelled" || order.status === "refunded";
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((s, i) => {
        const at = order[s.key];
        const done = Boolean(at);
        return (
          <li key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 rounded-full ${done ? "bg-moss" : "bg-sumi-20"}`}
              />
              {i < steps.length - 1 ? (
                <span className={`w-0.5 flex-1 ${done ? "bg-moss" : "bg-sumi-20"}`} />
              ) : null}
            </div>
            <div className="pb-5">
              <p className={`text-sm font-medium ${done ? "" : "text-sumi-40"}`}>{s.label}</p>
              {at ? (
                <p className="text-xs text-sumi-40">{new Date(at).toLocaleString()}</p>
              ) : null}
            </div>
          </li>
        );
      })}
      {dead ? (
        <li className="rounded-[6px] bg-kohaku/10 px-3 py-2 text-sm text-kohaku">
          Order {order.status}
          {order.status === "refunded" ? " — escrow returned to the buyer." : "."}
        </li>
      ) : null}
    </ol>
  );
}

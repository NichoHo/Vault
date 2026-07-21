const map: Record<string, string> = {
  pending_payment: "bg-kohaku text-white",
  funded: "bg-kohaku text-white",
  shipped: "bg-indigo text-white",
  completed: "bg-moss text-white",
  cancelled: "bg-sumi-40 text-white",
  refunded: "bg-sumi-40 text-white",
  active: "bg-moss text-white",
  reserved: "bg-kohaku text-white",
  sold: "bg-sumi-60 text-white",
  draft: "bg-sumi-40 text-white",
  withdrawn: "bg-kohaku text-white",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-[6px] px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-sumi-40 text-white"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

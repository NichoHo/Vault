const map: Record<string, string> = {
  pending_payment: "bg-kohaku text-on-solid",
  funded: "bg-kohaku text-on-solid",
  shipped: "bg-indigo text-on-solid",
  completed: "bg-moss text-on-solid",
  cancelled: "bg-sumi-40 text-on-solid",
  refunded: "bg-sumi-40 text-on-solid",
  active: "bg-moss text-on-solid",
  reserved: "bg-kohaku text-on-solid",
  sold: "bg-sumi-60 text-on-solid",
  draft: "bg-sumi-40 text-on-solid",
  withdrawn: "bg-kohaku text-on-solid",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-[6px] px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-sumi-40 text-on-solid"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

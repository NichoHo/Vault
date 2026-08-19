const map: Record<string, string> = {
  pending_payment: "bg-warning text-on-solid",
  funded: "bg-warning text-on-solid",
  shipped: "bg-primary text-on-solid",
  completed: "bg-success text-on-solid",
  cancelled: "bg-faint text-on-solid",
  refunded: "bg-faint text-on-solid",
  active: "bg-success text-on-solid",
  reserved: "bg-warning text-on-solid",
  sold: "bg-muted-foreground text-on-solid",
  draft: "bg-faint text-on-solid",
  withdrawn: "bg-warning text-on-solid",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-[6px] px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-faint text-on-solid"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

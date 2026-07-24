// Shown when a backend call throws (connection refused / timeout) rather than
// returning data. Deliberately distinct from an empty state: "no rows" and
// "service is down" must never look the same, or an outage reads as data loss.
export default function ServiceUnavailable({
  service,
  detail,
}: {
  service: string;
  detail?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-10 text-center">
      <p className="text-sm font-medium text-ink">Can’t reach the {service} service.</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">
        {detail ??
          "This is a connection problem, not missing data. Nothing has been lost, so try again in a moment."}
      </p>
    </div>
  );
}

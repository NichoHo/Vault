import { notFound } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import { ADMIN_EMAILS, ASSIST_URL } from "@/lib/env";
import { resolveRiskAction } from "./actions";

type Metrics = {
  suggestions_total: number;
  suggestions_with_outcome: number;
  acceptance_rate_by_field: Record<string, number | null>;
  trust_queue_open: number;
};

type Risk = {
  id: number;
  subject_type: string;
  subject_id: string;
  score: number;
  reasons: string[];
  status: string;
  created_at: string;
};

async function fetchAdmin<T>(token: string, path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${ASSIST_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const [user, token] = await Promise.all([getUser(), getToken()]);
  // don't advertise the admin surface to non-admins
  if (!user || !token || !ADMIN_EMAILS.includes(user.email.toLowerCase())) notFound();

  const [metrics, risks] = await Promise.all([
    fetchAdmin<Metrics>(token, "/admin/metrics"),
    fetchAdmin<Risk[]>(token, "/admin/trust"),
  ]);
  if (!metrics) {
    return <p className="text-sm text-sumi-60">The assist service is unreachable.</p>;
  }

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">Admin</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="AI suggestions" value={String(metrics.suggestions_total)} />
        <Stat label="With outcome" value={String(metrics.suggestions_with_outcome)} />
        <Stat
          label="Title accepted"
          value={pct(metrics.acceptance_rate_by_field["title"] ?? null)}
        />
        <Stat label="Trust queue" value={String(metrics.trust_queue_open)} accent />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold text-sumi-60">
        Acceptance rate by field (AI proposes, the human decides)
      </h2>
      <div className="flex gap-4 rounded-[8px] border border-sumi-20 bg-surface p-4 text-sm">
        {Object.entries(metrics.acceptance_rate_by_field).map(([field, rate]) => (
          <div key={field}>
            <p className="text-xs text-sumi-40">{field}</p>
            <p className="font-bold">{pct(rate)}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold text-sumi-60">Trust review queue</h2>
      {!risks || risks.length === 0 ? (
        <p className="text-sm text-sumi-60">Nothing flagged. Quiet day.</p>
      ) : (
        <ul className="divide-y divide-sumi-20 rounded-[8px] border border-sumi-20 bg-surface">
          {risks.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span
                className={`money rounded-[6px] px-2 py-0.5 text-xs font-bold text-white ${
                  r.score >= 0.8 ? "bg-torii" : "bg-kohaku"
                }`}
              >
                {r.score.toFixed(1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {r.subject_type} <code className="text-xs">{r.subject_id.slice(0, 8)}…</code>
                </p>
                <p className="truncate text-xs text-sumi-40">{r.reasons.join(" · ")}</p>
              </div>
              {r.status === "queued" ? (
                <div className="flex gap-2">
                  <form action={resolveRiskAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="action" value="approve" />
                    <button className="rounded-[6px] bg-moss px-2 py-1 text-xs text-white">
                      Approve
                    </button>
                  </form>
                  <form action={resolveRiskAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="action" value="reject" />
                    <button className="rounded-[6px] bg-torii px-2 py-1 text-xs text-white">
                      Reject
                    </button>
                  </form>
                </div>
              ) : (
                <span className="text-xs text-sumi-40">{r.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[8px] border border-sumi-20 bg-surface p-3">
      <p className="text-xs text-sumi-40">{label}</p>
      <p className={`money text-2xl font-bold ${accent ? "text-kohaku" : ""}`}>{value}</p>
    </div>
  );
}

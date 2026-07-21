"use client";

import { useState } from "react";

export default function ConsentForm({
  clientId,
  scope,
  returnTo,
}: {
  clientId: string;
  scope: string;
  returnTo: string;
}) {
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    const resp = await fetch("/idp/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, scope }),
    });
    if (resp.ok) {
      window.location.href = returnTo;
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={approve}
        disabled={busy}
        className="flex-1 rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Allowing…" : "Allow"}
      </button>
      <a
        href="/"
        className="flex-1 rounded-[6px] border border-sumi-20 px-3 py-2 text-center text-sm"
      >
        Deny
      </a>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

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
      <Button onClick={approve} disabled={busy} className="flex-1">
        {busy ? "Allowing…" : "Allow"}
      </Button>
      <a href="/" className={buttonVariants({ variant: "outline", className: "flex-1" })}>
        Deny
      </a>
    </div>
  );
}

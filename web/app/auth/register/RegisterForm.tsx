"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const resp = await fetch("/idp/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        handle: data.get("handle"),
        password: data.get("password"),
      }),
    });
    if (resp.ok) {
      window.location.href = returnTo;
    } else {
      setBusy(false);
      const body = (await resp.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        name="email"
        type="email"
        required
        autoComplete="email"
        spellCheck={false}
        aria-label="Email"
        placeholder="Email"
      />
      <Input
        name="handle"
        required
        minLength={3}
        maxLength={30}
        pattern="[a-z0-9_]+"
        autoComplete="username"
        spellCheck={false}
        aria-label="Handle"
        placeholder="Handle (a-z, 0-9, _)"
      />
      <Input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        aria-label="Password"
        placeholder="Password (8+ characters)"
      />
      <p aria-live="polite" className="text-sm text-danger empty:hidden">
        {error}
      </p>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Link
          href={`/auth/login?return_to=${encodeURIComponent(returnTo)}`}
          className="text-primary underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

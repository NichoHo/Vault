"use client";

import { useState } from "react";
import Link from "next/link";

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
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        spellCheck={false}
        aria-label="Email"
        placeholder="Email"
        className="rounded-[6px] border border-sumi-20 px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <input
        name="handle"
        required
        minLength={3}
        maxLength={30}
        pattern="[a-z0-9_]+"
        autoComplete="username"
        spellCheck={false}
        aria-label="Handle"
        placeholder="Handle (a-z, 0-9, _)"
        className="rounded-[6px] border border-sumi-20 px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        aria-label="Password"
        placeholder="Password (8+ characters)"
        className="rounded-[6px] border border-sumi-20 px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <p aria-live="polite" className="text-sm text-torii empty:hidden">
        {error}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-sumi-60">
        Have an account?{" "}
        <Link
          href={`/auth/login?return_to=${encodeURIComponent(returnTo)}`}
          className="text-indigo underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

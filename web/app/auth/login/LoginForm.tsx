"use client";

import { useState } from "react";
import Link from "next/link";

const field =
  "rounded-[6px] border border-sumi-20 px-3 py-2 text-sm outline-none focus:border-indigo";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"password" | "totp" | "recovery">("password");

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const resp = await fetch("/idp/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    if (!resp.ok) {
      setBusy(false);
      setError(resp.status === 401 ? "Invalid email or password." : "Something went wrong.");
      return;
    }
    const body = (await resp.json()) as { mfa_required?: boolean };
    if (body.mfa_required) {
      setBusy(false);
      setStep("totp");
    } else {
      window.location.href = returnTo;
    }
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const path = step === "totp" ? "/idp/login/totp" : "/idp/login/recovery";
    const resp = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.get("code") }),
    });
    if (resp.ok) {
      window.location.href = returnTo;
    } else {
      setBusy(false);
      setError(step === "totp" ? "Wrong code — try again." : "Invalid recovery code.");
    }
  }

  if (step !== "password") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-3">
        <p className="text-sm text-sumi-60">
          {step === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Enter one of your recovery codes."}
        </p>
        <input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          spellCheck={false}
          aria-label={step === "totp" ? "Authenticator code" : "Recovery code"}
          inputMode={step === "totp" ? "numeric" : "text"}
          placeholder={step === "totp" ? "123456" : "recovery code"}
          className={`${field} text-center tracking-widest`}
        />
        <p aria-live="polite" className="text-sm text-torii empty:hidden">
          {error}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
        <button
          type="button"
          onClick={() => setStep(step === "totp" ? "recovery" : "totp")}
          className="text-sm text-indigo underline"
        >
          {step === "totp" ? "Use a recovery code instead" : "Use authenticator code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        spellCheck={false}
        aria-label="Email"
        placeholder="Email"
        className={field}
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        aria-label="Password"
        placeholder="Password"
        className={field}
      />
      <p aria-live="polite" className="text-sm text-torii empty:hidden">
        {error}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-sumi-60">
        No account?{" "}
        <Link
          href={`/auth/register?return_to=${encodeURIComponent(returnTo)}`}
          className="text-indigo underline"
        >
          Register
        </Link>
      </p>
    </form>
  );
}

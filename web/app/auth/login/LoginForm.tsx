"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      setError(step === "totp" ? "Wrong code. Try again." : "Invalid recovery code.");
    }
  }

  if (step !== "password") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {step === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Enter one of your recovery codes."}
        </p>
        <Input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          spellCheck={false}
          aria-label={step === "totp" ? "Authenticator code" : "Recovery code"}
          inputMode={step === "totp" ? "numeric" : "text"}
          placeholder={step === "totp" ? "123456" : "recovery code"}
          className="text-center tracking-widest"
        />
        <p aria-live="polite" className="text-sm text-danger empty:hidden">
          {error}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </Button>
        <button
          type="button"
          onClick={() => setStep(step === "totp" ? "recovery" : "totp")}
          className="text-sm text-primary underline"
        >
          {step === "totp" ? "Use a recovery code instead" : "Use authenticator code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="flex flex-col gap-3">
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
        name="password"
        type="password"
        required
        autoComplete="current-password"
        aria-label="Password"
        placeholder="Password"
      />
      <p aria-live="polite" className="text-sm text-danger empty:hidden">
        {error}
      </p>
      <Button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href={`/auth/register?return_to=${encodeURIComponent(returnTo)}`}
          className="text-primary underline"
        >
          Register
        </Link>
      </p>
    </form>
  );
}

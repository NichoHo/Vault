"use client";

import { useEffect, useState } from "react";

const field =
  "rounded-[6px] border border-sumi-20 px-3 py-2 text-sm outline-none focus:border-indigo";

type State =
  | { step: "loading" }
  | { step: "signed_out" }
  | { step: "disabled" }
  | { step: "enrolling"; secret: string; uri: string }
  | { step: "codes"; codes: string[] }
  | { step: "enabled" };

export default function MfaManager() {
  const [state, setState] = useState<State>({ step: "loading" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/idp/mfa").then(async (resp) => {
      if (resp.status === 401) return setState({ step: "signed_out" });
      const body = (await resp.json()) as { enabled: boolean };
      setState({ step: body.enabled ? "enabled" : "disabled" });
    });
  }, []);

  async function enroll() {
    setError("");
    const resp = await fetch("/idp/mfa/enroll", { method: "POST" });
    if (!resp.ok) return setError("Could not start enrollment.");
    const body = (await resp.json()) as { secret: string; otpauth_uri: string };
    setState({ step: "enrolling", secret: body.secret, uri: body.otpauth_uri });
  }

  async function activate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const code = new FormData(e.currentTarget).get("code");
    const resp = await fetch("/idp/mfa/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!resp.ok) return setError("Wrong code — check your authenticator and try again.");
    const body = (await resp.json()) as { recovery_codes: string[] };
    setState({ step: "codes", codes: body.recovery_codes });
  }

  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const code = new FormData(e.currentTarget).get("code");
    const resp = await fetch("/idp/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!resp.ok) return setError("Wrong code.");
    setState({ step: "disabled" });
  }

  switch (state.step) {
    case "loading":
      return <p className="text-sm text-sumi-40">Loading…</p>;
    case "signed_out":
      return (
        <p className="text-sm text-sumi-60">
          Sign in first —{" "}
          <a href="/auth/start?next=/auth/mfa" className="text-indigo underline">
            sign in
          </a>
          .
        </p>
      );
    case "disabled":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-sumi-60">
            Two-factor authentication is <span className="font-medium text-ink">off</span>.
            Enable it to require a 6-digit code at every sign-in.
          </p>
          {error ? <p className="text-sm text-torii">{error}</p> : null}
          <button
            onClick={enroll}
            className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white"
          >
            Enable two-factor authentication
          </button>
        </div>
      );
    case "enrolling":
      return (
        <form onSubmit={activate} className="flex flex-col gap-3">
          <p className="text-sm text-sumi-60">
            Add this key to your authenticator app (Google Authenticator, 1Password, …) using
            “enter a setup key”, then confirm with a code.
          </p>
          <div className="rounded-[6px] bg-paper p-3">
            <p className="text-xs text-sumi-40">Secret key</p>
            <code className="break-all text-sm font-bold tracking-wider">{state.secret}</code>
          </div>
          <details className="text-xs text-sumi-40">
            <summary className="cursor-pointer">otpauth:// URI</summary>
            <code className="break-all">{state.uri}</code>
          </details>
          <input
            name="code"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="123456"
            className={`${field} text-center tracking-widest`}
          />
          {error ? <p className="text-sm text-torii">{error}</p> : null}
          <button className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white">
            Confirm & enable
          </button>
        </form>
      );
    case "codes":
      return (
        <div className="flex flex-col gap-3">
          <p className="rounded-[6px] bg-moss/10 px-3 py-2 text-sm text-moss">
            Two-factor authentication is now on.
          </p>
          <p className="text-sm text-sumi-60">
            Save these recovery codes somewhere safe — each works once if you lose your
            authenticator. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-[6px] bg-paper p-3">
            {state.codes.map((c) => (
              <code key={c} className="text-sm">
                {c}
              </code>
            ))}
          </div>
          <button
            onClick={() => setState({ step: "enabled" })}
            className="rounded-[6px] border border-sumi-20 px-3 py-2 text-sm"
          >
            I saved them
          </button>
        </div>
      );
    case "enabled":
      return (
        <form onSubmit={disable} className="flex flex-col gap-3">
          <p className="text-sm">
            Two-factor authentication is{" "}
            <span className="font-medium text-moss">on</span>.
          </p>
          <p className="text-sm text-sumi-60">To turn it off, enter a current code:</p>
          <input
            name="code"
            required
            inputMode="numeric"
            placeholder="123456"
            className={`${field} text-center tracking-widest`}
          />
          {error ? <p className="text-sm text-torii">{error}</p> : null}
          <button className="rounded-[6px] border border-torii px-3 py-2 text-sm text-torii">
            Disable two-factor authentication
          </button>
        </form>
      );
  }
}

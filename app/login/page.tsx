"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const next = useSearchParams().get("next") || "/add";
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't work.");
      return;
    }
    // Full navigation so the new cookie is sent and no cached redirect is reused.
    window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/add");
  }

  return (
    <form onSubmit={submit} className="panel" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1 style={{ fontSize: 30 }}>Hello, Oma</h1>
      <p className="muted" style={{ margin: 0 }}>Type the family word to add recipes and photos.</p>
      <div className="field">
        <label htmlFor="passcode">Family word</label>
        <input id="passcode" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" disabled={busy || !passcode}>Come in</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

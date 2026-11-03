"use client";

import Link from "next/link";
import { signOut, useEditor, usingSupabase } from "@/lib/data";
import { LoginForm } from "./LoginForm";

/** Shows its children only to signed-in family editors; otherwise a sign-in form or a friendly note. */
export function EditorGate({ children }: { children: React.ReactNode }) {
  const { session, isEditor, loading } = useEditor();
  if (!usingSupabase) {
    return <p className="panel" style={{ margin: "40px auto", maxWidth: 520 }}>Adding recipes needs the Supabase settings, which this copy of the site doesn&apos;t have.</p>;
  }
  if (loading) return <p className="muted" style={{ padding: 40, textAlign: "center" }}>One moment…</p>;
  if (!session) return <LoginForm />;
  if (!isEditor) {
    return (
      <div className="panel" style={{ maxWidth: 460, margin: "60px auto" }}>
        <h1 style={{ fontSize: 28 }}>Nearly there</h1>
        <p className="muted" style={{ margin: 0 }}>
          You&apos;re signed in as {session.user.email}, but this account isn&apos;t on the family list yet. Ask Ken to add you.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/" className="btn alt">Back to the recipes</Link>
          <button type="button" className="btn alt" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

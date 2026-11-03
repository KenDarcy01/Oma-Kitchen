"use client";

import Link from "next/link";
import { signOut, useEditor, usingSupabase } from "@/lib/data";

export function TopBar() {
  const { session, isEditor } = useEditor();
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="brand">Oma&apos;s Kitchen</Link>
        <nav className="nav">
          {usingSupabase && (!session || isEditor) && <Link href="/add/" className="btn small">+ Add a recipe</Link>}
          {session && (
            <button type="button" className="btn alt small" onClick={() => signOut()}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

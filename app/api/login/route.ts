import { NextResponse } from "next/server";
import { AUTH_COOKIE, passcodeToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const expected = process.env.OMA_PASSCODE;
  if (!expected) {
    if (process.env.NODE_ENV !== "production") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "The family word hasn't been set up yet (OMA_PASSCODE)." }, { status: 500 });
  }
  if (!passcode || passcode.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return NextResponse.json({ error: "That isn't the family word. Try again?" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await passcodeToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

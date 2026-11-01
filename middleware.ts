import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (await isValidToken(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in with the family passcode first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/add", "/recipes/:slug/photo", "/api/tidy", "/api/recipes", "/api/recipes/:slug/photo"],
};

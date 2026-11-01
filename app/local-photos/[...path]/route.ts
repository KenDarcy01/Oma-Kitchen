import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PHOTOS } from "@/lib/store";

export const runtime = "nodejs";

/** Serves photos saved in local development (no Supabase). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const file = path.resolve(LOCAL_PHOTOS, ...parts);
  if (!file.startsWith(LOCAL_PHOTOS + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(file);
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(bytes), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { Recipe, RecipeDraft } from "./recipe";
import { slugify } from "./recipe";
import { SAMPLE_RECIPES } from "./samples";

/**
 * Everything runs in the browser (the site is static on GitHub Pages):
 * - anyone can read published recipes with the publishable key,
 * - signed-in family editors (public.oma_editors) can add recipes and upload photos (enforced by RLS),
 * - Claude's tidy-up runs in the `oma-tidy` Supabase Edge Function, which holds the API key.
 * Without the Supabase env vars, the site shows the example recipes read-only (handy for design work).
 */

const TABLE = "oma_recipes";
const BUCKET = "oma-photos";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const usingSupabase = Boolean(URL && KEY);
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!usingSupabase) throw new Error("Supabase isn't configured for this site.");
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export function photoUrl(p: string | null): string | null {
  if (!p) return null;
  return `${URL}/storage/v1/object/public/${BUCKET}/${p}`;
}

// ---------- reading ----------
export async function listRecipes(category?: string): Promise<Recipe[]> {
  if (!usingSupabase) return SAMPLE_RECIPES.filter((r) => !category || r.category === category);
  let q = supabase().from(TABLE).select("*").order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Recipe[];
}

export async function getRecipe(slug: string): Promise<Recipe | null> {
  if (!usingSupabase) return SAMPLE_RECIPES.find((r) => r.slug === slug) ?? null;
  const { data, error } = await supabase().from(TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Recipe) ?? null;
}

// ---------- signing in ----------
export type Editor = { session: Session | null; isEditor: boolean; loading: boolean };

export function useEditor(): Editor {
  const [state, setState] = useState<Editor>({ session: null, isEditor: false, loading: usingSupabase });
  useEffect(() => {
    if (!usingSupabase) return;
    const sb = supabase();
    let alive = true;
    async function check(session: Session | null) {
      let isEditor = false;
      if (session) {
        const { data } = await sb.rpc("oma_is_editor");
        isEditor = data === true;
      }
      if (alive) setState({ session, isEditor, loading: false });
    }
    sb.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      check(session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match. Try again?" : error.message);
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

// ---------- writing (editors only; RLS enforces it) ----------
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await getRecipe(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createRecipe(
  draft: Omit<RecipeDraft, "questions">,
  extra: { original_text: string | null; card_image_path: string | null; photo_path?: string | null },
): Promise<string> {
  const slug = await uniqueSlug(draft.title);
  const { error } = await supabase().from(TABLE).insert({ ...draft, ...extra, slug });
  if (error) throw new Error(error.code === "42501" ? "This account isn't allowed to add recipes yet." : error.message);
  return slug;
}

export async function uploadImage(folder: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const name = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase().storage.from(BUCKET).upload(name, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(error.message);
  return name;
}

export async function setRecipePhoto(slug: string, photoPath: string): Promise<void> {
  const { error } = await supabase().from(TABLE).update({ photo_path: photoPath }).eq("slug", slug);
  if (error) throw new Error(error.message);
}

/** Shrink a photo to at most `max` px on its long side, as JPEG, so uploads and Claude requests stay small. */
export async function shrinkImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that photo."))), "image/jpeg", quality));
}

/** Where Claude found a photo of the dish on a card image: edges on a 0-1000 scale of that image. */
export type DishPhoto = { card: number; left: number; top: number; right: number; bottom: number };

/** Cut the dish photo out of a card image. Returns null when the box is missing or too small to be a real photo. */
export async function cropDishPhoto(card: Blob, b: DishPhoto): Promise<Blob | null> {
  const bmp = await createImageBitmap(card);
  const clamp = (v: number) => Math.min(1000, Math.max(0, v)) / 1000;
  const x0 = clamp(Math.min(b.left, b.right)), x1 = clamp(Math.max(b.left, b.right));
  const y0 = clamp(Math.min(b.top, b.bottom)), y1 = clamp(Math.max(b.top, b.bottom));
  if (x1 - x0 < 0.1 || y1 - y0 < 0.1) return null;
  // Trim a sliver off each edge so a loose box doesn't pull in the photo's border or the text beside it.
  const inset = 0.01;
  const sx = Math.round((x0 + inset) * bmp.width), sy = Math.round((y0 + inset) * bmp.height);
  const sw = Math.round((x1 - x0 - 2 * inset) * bmp.width), sh = Math.round((y1 - y0 - 2 * inset) * bmp.height);
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  c.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise((res) => c.toBlob((out) => res(out), "image/jpeg", 0.9));
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Ask Claude (via the oma-tidy Edge Function) to turn text and/or card photos into a recipe draft.
 * When a card has a photo of the finished dish on it, dishPhoto says where.
 */
export async function tidyRecipe(text: string, cards: Blob[]): Promise<{ draft: RecipeDraft; dishPhoto: DishPhoto | null }> {
  const images = await Promise.all(cards.map(async (c) => ({ media_type: "image/jpeg", data: await toBase64(c) })));
  const { data, error } = await supabase().functions.invoke("oma-tidy", { body: { text, images } });
  if (error) {
    // FunctionsHttpError carries the function's JSON body in `context`.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(body?.error ?? "The recipe helper had a hiccup. Please try again.");
  }
  const out = data as { draft: RecipeDraft; dish_photo?: DishPhoto | null };
  return { draft: out.draft, dishPhoto: out.dish_photo ?? null };
}

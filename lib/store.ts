import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Recipe, RecipeDraft } from "./recipe";
import { slugify } from "./recipe";
import { SAMPLE_RECIPES } from "./samples";

/**
 * Recipe storage.
 * With Supabase env vars set, recipes live in `public.oma_recipes` and photos in the `oma-photos` bucket.
 * Without them (local development), recipes live in .data/recipes.json and photos in .data/photos.
 */

const TABLE = "oma_recipes";
const BUCKET = "oma-photos";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const usingSupabase = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

let readClient: SupabaseClient | null = null;
let writeClient: SupabaseClient | null = null;

function reader(): SupabaseClient {
  readClient ??= createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  return readClient;
}

function writer(): SupabaseClient {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set, so recipes can't be saved yet.");
  writeClient ??= createClient(SUPABASE_URL!, SERVICE_KEY, { auth: { persistSession: false } });
  return writeClient;
}

export function photoUrl(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith("local:")) return "/local-photos/" + p.slice(6);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
}

// ---------- local fallback ----------
const DATA_FILE = path.join(process.cwd(), ".data", "recipes.json");
export const LOCAL_PHOTOS = path.join(process.cwd(), ".data", "photos");

async function readLocal(): Promise<Recipe[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Recipe[];
  } catch {
    return SAMPLE_RECIPES;
  }
}
async function writeLocal(all: Recipe[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2));
}

// ---------- public API ----------
export async function listRecipes(category?: string): Promise<Recipe[]> {
  if (!usingSupabase) {
    const all = await readLocal();
    return all
      .filter((r) => !category || r.category === category)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  let q = reader().from(TABLE).select("*").order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Recipe[];
}

export async function getRecipe(slug: string): Promise<Recipe | null> {
  if (!usingSupabase) return (await readLocal()).find((r) => r.slug === slug) ?? null;
  const { data, error } = await reader().from(TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Recipe) ?? null;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await getRecipe(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createRecipe(
  draft: Omit<RecipeDraft, "questions">,
  extra: { original_text: string | null; card_image_path: string | null },
): Promise<Recipe> {
  const slug = await uniqueSlug(draft.title);
  const row = { ...draft, ...extra, slug, photo_path: null as string | null };
  if (!usingSupabase) {
    const all = await readLocal();
    const recipe: Recipe = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
    await writeLocal([recipe, ...all]);
    return recipe;
  }
  const { data, error } = await writer().from(TABLE).insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as Recipe;
}

export async function uploadImage(folder: string, bytes: Buffer, contentType: string): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const name = `${folder}/${Date.now()}.${ext}`;
  if (!usingSupabase) {
    const file = path.join(LOCAL_PHOTOS, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return "local:" + name;
  }
  const { error } = await writer().storage.from(BUCKET).upload(name, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return name;
}

export async function setRecipePhoto(slug: string, photoPath: string): Promise<void> {
  if (!usingSupabase) {
    const all = await readLocal();
    const r = all.find((x) => x.slug === slug);
    if (!r) throw new Error("Recipe not found");
    r.photo_path = photoPath;
    await writeLocal(all);
    return;
  }
  const { error } = await writer().from(TABLE).update({ photo_path: photoPath }).eq("slug", slug);
  if (error) throw new Error(error.message);
}

import { NextResponse } from "next/server";
import { getRecipe, setRecipePhoto, uploadImage } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) return NextResponse.json({ error: "That recipe doesn't exist." }, { status: 404 });

  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    return NextResponse.json({ error: "Photos must be JPG, PNG or WebP." }, { status: 400 });
  }
  try {
    const p = await uploadImage(`recipes/${slug}`, Buffer.from(await photo.arrayBuffer()), photo.type);
    await setRecipePhoto(slug, p);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

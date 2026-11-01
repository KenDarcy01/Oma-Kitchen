import { NextResponse } from "next/server";
import { z } from "zod";
import { RecipeDraftSchema } from "@/lib/recipe";
import { createRecipe } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({
  draft: RecipeDraftSchema.omit({ questions: true }),
  original_text: z.string().nullable().optional(),
  card_image_path: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Something in the recipe is missing. Check the title and ingredients." }, { status: 400 });
  }
  const { draft, original_text, card_image_path } = parsed.data;
  if (!draft.title.trim()) return NextResponse.json({ error: "Give the recipe a name first." }, { status: 400 });
  try {
    const recipe = await createRecipe(draft, {
      original_text: original_text ?? null,
      card_image_path: card_image_path ?? null,
    });
    return NextResponse.json({ slug: recipe.slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

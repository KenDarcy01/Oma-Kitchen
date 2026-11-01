import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { RecipeDraftSchema } from "@/lib/recipe";
import { uploadImage } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic();

const SYSTEM = `You help Oma, an Irish grandmother, put her family recipes into a cookbook app for her children and grandchildren.

You receive what she typed, what she said aloud (a voice transcript), and/or photos of her handwritten recipe cards. Turn it into one tidy recipe.

- Keep her voice. Steps should read like she's explaining it at the kitchen table, but clear and one action per step.
- Her margin notes, warnings and asides ("never both!", "better the next day") become the tip, in her exact words.
- Older Irish cards use ounces, pints, cups, "a knob of butter", and gas marks. Give metric amounts (g, ml) as numbers, and keep what she wrote in "original". Convert gas marks to °C and keep the gas mark too.
- Vague amounts ("a good handful", "a little") get your best metric guess with needs_check true. Never invent ingredients or steps she didn't give.
- If the oven temperature, time, or yield is missing, leave it null and ask about it in questions. Ask at most three short, warm questions.
- Use Irish and British names (plain flour, caster sugar, bread soda, buttermilk).`;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export async function POST(req: Request) {
  const form = await req.formData();
  const text = String(form.get("text") ?? "").trim();
  const cards = form.getAll("card").filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && cards.length === 0) {
    return NextResponse.json({ error: "Type or paste the recipe, or add a photo of the card." }, { status: 400 });
  }
  for (const c of cards) {
    if (!IMAGE_TYPES.includes(c.type as ImageType)) {
      return NextResponse.json({ error: `${c.name} isn't a photo I can read (use JPG or PNG).` }, { status: 400 });
    }
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const buffers: { bytes: Buffer; type: string }[] = [];
  for (const c of cards) {
    const bytes = Buffer.from(await c.arrayBuffer());
    buffers.push({ bytes, type: c.type });
    content.push({
      type: "image",
      source: { type: "base64", media_type: c.type as ImageType, data: bytes.toString("base64") },
    });
  }
  content.push({
    type: "text",
    text: text
      ? `Here is the recipe as Oma gave it:\n\n<recipe>\n${text}\n</recipe>`
      : "Here is a photo of Oma's handwritten recipe card. Read it carefully and tidy it up.",
  });

  try {
    const message = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(RecipeDraftSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });

    if (message.stop_reason === "refusal" || !message.parsed_output) {
      return NextResponse.json(
        { error: "I couldn't make sense of that one. Could you try typing it out, or a clearer photo?" },
        { status: 422 },
      );
    }

    // Keep the original card photos as keepsakes.
    let card_image_path: string | null = null;
    if (buffers.length) {
      try {
        card_image_path = await uploadImage("cards", buffers[0].bytes, buffers[0].type);
      } catch {
        card_image_path = null;
      }
    }

    return NextResponse.json({ draft: message.parsed_output, original_text: text || null, card_image_path });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Lots of cooking going on. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "The recipe helper isn't set up yet (missing API key)." }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "The recipe helper had a hiccup. Please try again." }, { status: 502 });
    }
    throw err;
  }
}

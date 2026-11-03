// Oma's Kitchen: turns what Oma typed, said, or photographed into a tidy recipe draft.
// Runs as a Supabase Edge Function so the Claude API key never reaches the browser.
// Only signed-in family editors (public.oma_editors) may call it.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { z } from "npm:zod@4.6.7";

// Keep in sync with lib/recipe.ts (RecipeDraftSchema).
const CATEGORIES = ["Baking", "Puddings", "Breads", "Sunday dinner", "Soups & starters", "Christmas", "Everyday meals"] as const;
const Ingredient = z.object({
  name: z.string().describe("Ingredient name in plain English, e.g. 'Bramley apples' or 'Plain flour'"),
  amount: z.number().nullable().describe("Metric amount as a number (grams, ml) or a count. Null for 'to taste' or 'a pinch'."),
  unit: z.string().describe("Unit for amount: g, kg, ml, l, tsp, tbsp, or a count word such as 'large', or '' for plain counts"),
  original: z.string().nullable().describe("The amount exactly as Oma wrote or said it, e.g. '8oz', 'a good handful'. Null if same as metric."),
  note: z.string().nullable().describe("Short prep note, e.g. 'peeled and sliced', or null"),
  needs_check: z.boolean().describe("True when the amount was a guess from a vague phrase and Oma should confirm it"),
});
const RecipeDraft = z.object({
  title: z.string(),
  subtitle: z.string().nullable().describe("A short description line, e.g. 'Plate tart with Bramleys'"),
  category: z.enum(CATEGORIES),
  season: z.string().nullable().describe("Spring, Summer, Autumn, Winter, Christmas, Easter, Halloween or null"),
  yield_amount: z.number().nullable().describe("How many it makes, e.g. 8"),
  yield_unit: z.string().nullable().describe("slices, servings, scones, loaves, bowls ..."),
  total_minutes: z.number().int().nullable(),
  oven_c: z.number().int().nullable().describe("Oven temperature in °C (conventional, not fan)"),
  gas_mark: z.string().nullable().describe("Gas mark, e.g. '6'"),
  difficulty: z.enum(["Easy", "Medium", "A bit of a project"]).nullable(),
  ingredients: z.array(Ingredient),
  steps: z.array(z.string()).describe("Clear numbered steps in Oma's voice, one action each"),
  tip: z.string().nullable().describe("Oma's personal tip or margin note, kept in her own words"),
  questions: z.array(z.string()).describe("Gentle questions for Oma about anything missing or unclear, e.g. 'How long in the oven?'"),
});

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
const Body = z.object({
  text: z.string().max(20000).default(""),
  images: z.array(z.object({ media_type: z.enum(IMAGE_TYPES), data: z.string().max(8_000_000) })).max(4).default([]),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let anthropic: Anthropic | null = null; // created on first use from the ANTHROPIC_API_KEY secret

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // Who is asking? Check the signed-in user and that they're on the family editors list.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (!userData?.user) return json({ error: "Please sign in first." }, 401);
  const { data: isEditor } = await supabase.rpc("oma_is_editor");
  if (!isEditor) return json({ error: "This account isn't on the family list yet. Ask Ken to add you." }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "That request didn't look right." }, 400);
  const { text, images } = parsed.data;
  if (!text.trim() && images.length === 0) return json({ error: "Type or paste the recipe, or add a photo of the card." }, 400);

  const content: Anthropic.Beta.BetaContentBlockParam[] = images.map((im) => ({
    type: "image",
    source: { type: "base64", media_type: im.media_type as ImageType, data: im.data },
  }));
  content.push({
    type: "text",
    text: text.trim()
      ? `Here is the recipe as Oma gave it:\n\n<recipe>\n${text.trim()}\n</recipe>`
      : "Here is a photo of Oma's handwritten recipe card. Read it carefully and tidy it up.",
  });

  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return json({ error: "The recipe helper isn't set up yet (missing Claude API key)." }, 500);
  }
  anthropic ??= new Anthropic();

  try {
    const message = await anthropic.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(RecipeDraft) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    if (message.stop_reason === "refusal" || !message.parsed_output) {
      return json({ error: "I couldn't make sense of that one. Could you try typing it out, or a clearer photo?" }, 422);
    }
    return json({ draft: message.parsed_output });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Lots of cooking going on. Try again in a minute." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The recipe helper isn't set up yet (missing Claude API key)." }, 500);
    return json({ error: "The recipe helper had a hiccup. Please try again." }, 502);
  }
});

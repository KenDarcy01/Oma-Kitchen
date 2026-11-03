import { z } from "zod";

export const CATEGORIES = [
  "Baking",
  "Puddings",
  "Breads",
  "Sunday dinner",
  "Soups & starters",
  "Christmas",
  "Everyday meals",
] as const;

export const IngredientSchema = z.object({
  name: z.string().describe("Ingredient name in plain English, e.g. 'Bramley apples' or 'Plain flour'"),
  amount: z
    .number()
    .nullable()
    .describe("Metric amount as a number (grams, ml) or a count. Null for 'to taste' or 'a pinch'."),
  unit: z
    .string()
    .describe("Unit for amount: g, kg, ml, l, tsp, tbsp, or a count word such as 'large', or '' for plain counts"),
  original: z
    .string()
    .nullable()
    .describe("The amount exactly as Oma wrote or said it, e.g. '8oz', 'a good handful', '1 cup'. Null if same as metric."),
  note: z.string().nullable().describe("Short prep note, e.g. 'peeled and sliced', or null"),
  needs_check: z
    .boolean()
    .describe("True when the amount was a guess from a vague phrase and Oma should confirm it"),
});

export const RecipeDraftSchema = z.object({
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
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe("Clear numbered steps in Oma's voice, one action each"),
  tip: z.string().nullable().describe("Oma's personal tip or margin note, kept in her own words"),
  questions: z
    .array(z.string())
    .describe("Gentle questions for Oma about anything missing or unclear, e.g. 'How long in the oven?'"),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

export type Recipe = Omit<RecipeDraft, "questions"> & {
  id: string;
  slug: string;
  original_text: string | null;
  card_image_path: string | null;
  photo_path: string | null;
  created_at: string;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "recipe";
}

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

function prettyCount(v: number): string {
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac < 0.08) return String(whole);
  if (frac > 0.92) return String(whole + 1);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return (whole ? String(whole) : "") + best[1];
}

/** Format a (possibly scaled) amount for display. */
export function formatAmount(amount: number | null, unit: string): string {
  if (amount == null) return unit || "";
  const u = unit.trim();
  if (u === "g" || u === "ml") {
    if (amount >= 1000) {
      const big = Math.round(amount / 100) / 10;
      return `${big} ${u === "g" ? "kg" : "l"}`;
    }
    const step = amount >= 100 ? 5 : 1;
    return `${Math.round(amount / step) * step} ${u}`;
  }
  return `${prettyCount(amount)}${u ? " " + u : ""}`.trim();
}

export function formatMinutes(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export const CELSIUS_TO_GAS: Record<number, string> = {
  140: "1", 150: "2", 160: "3", 170: "3", 180: "4", 190: "5", 200: "6", 210: "6", 220: "7", 230: "8", 240: "9",
};

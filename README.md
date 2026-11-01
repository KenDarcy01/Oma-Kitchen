# Oma's Kitchen

A family cookbook for Oma's recipes: mostly Irish bakes, puddings and Sunday dinners.

- **Add a recipe** (`/add`): type or paste it, upload a photo of a handwritten card, or speak it. Claude tidies it into ingredients, steps, times and oven temperature, keeping ounces and gas marks next to the metric amounts and Oma's notes as "Oma's tip". Oma checks the draft and saves.
- **Photo studio** (`/recipes/<slug>/photo`): take or choose a photo; the plate is cut out in the browser and placed on a styled backdrop (marble, linen, wood, slate, tablecloth, cream, or your own), with light and colour fixed and a soft shadow.
- **Browse** (`/`) and **recipe pages** with a servings scaler and Oma's original card.

Anyone with the link can read recipes. Adding recipes and photos needs the family word (`OMA_PASSCODE`).

## Stack

Next.js 15 (App Router) · Supabase (Postgres + Storage, in the Family Quiz project, tables prefixed `oma_`) · Claude API (`claude-opus-5-5`, structured outputs) · `@imgly/background-removal` (runs on the device).

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the keys
npm run dev
```

Without the Supabase variables the app runs on local files in `.data/` with three example recipes, which is handy for working on the design. Without `OMA_PASSCODE` the add pages are open in development and locked in production.

### Environment

| Variable | What it's for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude, for tidying recipes and reading cards |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Reading recipes |
| `SUPABASE_SERVICE_ROLE_KEY` | Saving recipes and photos (server only) |
| `OMA_PASSCODE` | The family word that unlocks adding |

### Database

`supabase/migrations/` holds the schema. It has already been applied to the Family Quiz project.

## Notes

- Background removal downloads its model (a few tens of MB) from `staticimgly.com` the first time it runs on a device, then caches it.
- `@imgly/background-removal` is AGPL-3.0 licensed. That's fine for a family app whose source is on GitHub; if this ever becomes a closed commercial product, swap it for a paid API such as remove.bg.

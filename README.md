# Oma's Kitchen

A family cookbook for Oma's recipes: mostly Irish bakes, puddings and Sunday dinners.

- **Add a recipe** (`/add/`): type or paste it, upload a photo of a handwritten card, or speak it. Claude tidies it into ingredients, steps, times and oven temperature, keeping ounces and gas marks next to the metric amounts and Oma's notes as "Oma's tip". Oma checks the draft and saves.
- **Photo studio** (`/recipe/photo/?slug=…`): take or choose a photo; the plate is cut out in the browser and placed on a styled backdrop (marble, linen, wood, slate, tablecloth, cream, or your own), with light and colour fixed and a soft shadow.
- **Browse** (`/`) and **recipe pages** (`/recipe/?slug=…`) with a servings scaler and Oma's original card.

Anyone with the link can read recipes. Adding recipes and photos needs a sign-in whose email is on the family editors list.

## How it fits together

The site is static and hosted on **GitHub Pages**, so everything runs in the browser:

- **Supabase** (the Family Quiz project; everything is prefixed `oma_` / `oma-`): table `oma_recipes`, photo bucket `oma-photos`, and `oma_editors`, the list of emails allowed to add and change recipes. Row-level security enforces that list, so the public key in the site can only read.
- **Claude** runs in the Supabase Edge Function `oma-tidy` (`supabase/functions/oma-tidy`), which holds the API key and only answers signed-in editors.
- **Background removal** (`@imgly/background-removal`) runs on Oma's device.

## One-time setup

1. **Turn on Pages**: repo Settings → Pages → Source: **GitHub Actions**. Every push to `main` then publishes to `https://kendarcy01.github.io/Oma-Kitchen/`.
2. **Claude key**: Supabase dashboard → Edge Functions → Secrets → add `ANTHROPIC_API_KEY`.
3. **Sign-ins**: Supabase dashboard → Authentication → Users → *Add user* (email + password, auto-confirm) for Oma and anyone else who adds recipes. Then put their emails on the list in the SQL editor:
   ```sql
   insert into public.oma_editors (email) values ('oma@example.com');
   ```

## Working on it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without the Supabase variables the site shows three example recipes read-only, handy for design work.

`supabase/migrations/` holds the schema and `supabase/functions/oma-tidy` the Edge Function; both are already applied/deployed to the Family Quiz project. Keep the recipe schema in the function in step with `lib/recipe.ts`.

## Notes

- Background removal downloads its model (a few tens of MB) from `staticimgly.com` the first time it runs on a device, then caches it.
- `@imgly/background-removal` is AGPL-3.0 licensed. That's fine for a family app whose source is on GitHub; if this ever becomes a closed commercial product, swap it for a paid API such as remove.bg.

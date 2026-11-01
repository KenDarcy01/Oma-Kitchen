import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Ingredients } from "@/components/Ingredients";
import { RecipeImage } from "@/components/RecipeImage";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { formatMinutes } from "@/lib/recipe";
import { getRecipe, photoUrl } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await getRecipe((await params).slug);
  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) notFound();
  const canEdit = await isValidToken((await cookies()).get(AUTH_COOKIE)?.value);
  const card = photoUrl(recipe.card_image_path);

  return (
    <article>
      <div className="r-hero">
        <RecipeImage recipe={recipe} priority />
      </div>
      <div className="r-body">
        <div className="wrap">
          <div className="r-title" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "start" }}>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 6px" }}>{recipe.category}{recipe.season ? ` · ${recipe.season}` : ""}</p>
              <h1>{recipe.title}</h1>
              {recipe.subtitle && <p className="muted" style={{ margin: "6px 0 0" }}>{recipe.subtitle}</p>}
            </div>
            {canEdit && (
              <Link href={`/recipes/${recipe.slug}/photo`} className="btn alt small">
                {recipe.photo_path ? "Change photo" : "Add a photo"}
              </Link>
            )}
          </div>
          <div className="meta">
            {recipe.total_minutes ? <div><b>{formatMinutes(recipe.total_minutes)}</b>total</div> : null}
            {recipe.oven_c ? <div><b>{recipe.oven_c} °C</b>{recipe.gas_mark ? `Gas ${recipe.gas_mark} · fan ${recipe.oven_c - 20} °C` : `fan ${recipe.oven_c - 20} °C`}</div> : null}
            {recipe.difficulty ? <div><b>{recipe.difficulty}</b>level</div> : null}
          </div>

          <div className="r-layout">
            <section aria-labelledby="ing-h">
              <h2 id="ing-h" style={{ fontSize: 24, marginBottom: 12 }}>Ingredients</h2>
              <Ingredients ingredients={recipe.ingredients} yieldAmount={recipe.yield_amount} yieldUnit={recipe.yield_unit} />
            </section>
            <section aria-labelledby="method-h">
              <h2 id="method-h" style={{ fontSize: 24, marginBottom: 14 }}>Method</h2>
              <ol className="steps">
                {recipe.steps.map((s, i) => <li key={i}><span>{s}</span></li>)}
              </ol>
              {recipe.tip && (
                <div className="tip">
                  <div className="hand">{recipe.tip}</div>
                  <div className="small">Oma&apos;s tip</div>
                </div>
              )}
              {card && (
                <details style={{ marginTop: 24 }}>
                  <summary className="small" style={{ cursor: "pointer" }}>See Oma&apos;s original card</summary>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card} alt={`Oma's handwritten card for ${recipe.title}`} style={{ marginTop: 12, borderRadius: 8, maxHeight: 520 }} />
                </details>
              )}
            </section>
          </div>
        </div>
      </div>
    </article>
  );
}

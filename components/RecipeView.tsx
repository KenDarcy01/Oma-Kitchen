"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Ingredients } from "@/components/Ingredients";
import { RecipeImage } from "@/components/RecipeImage";
import { getRecipe, photoUrl, useEditor } from "@/lib/data";
import { formatMinutes, type Recipe } from "@/lib/recipe";

export function RecipeView() {
  const slug = useSearchParams().get("slug") ?? "";
  const { isEditor } = useEditor();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);

  useEffect(() => {
    getRecipe(slug).then(setRecipe, () => setRecipe(null));
  }, [slug]);
  useEffect(() => {
    if (recipe) document.title = `${recipe.title} · Oma's Kitchen`;
  }, [recipe]);

  if (recipe === undefined) return <p className="wrap muted" style={{ padding: "60px 20px" }}>Finding the recipe…</p>;
  if (recipe === null) {
    return (
      <div className="wrap empty">
        <p className="hand" style={{ fontSize: 30 }}>That recipe isn&apos;t in the box.</p>
        <Link href="/" className="btn">See all recipes</Link>
      </div>
    );
  }
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
            {isEditor && (
              <Link href={`/recipe/photo/?slug=${encodeURIComponent(recipe.slug)}`} className="btn alt small">
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

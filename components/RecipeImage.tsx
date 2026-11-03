"use client";

import type { Recipe } from "@/lib/recipe";
import { photoUrl } from "@/lib/data";

/** The recipe's studio photo, or a warm placeholder with its first letter. */
export function RecipeImage({ recipe, priority = false }: { recipe: Recipe; priority?: boolean }) {
  const url = photoUrl(recipe.photo_path);
  if (!url) {
    return (
      <div className="ph" aria-hidden="true">
        {recipe.title.replace(/^Oma'?s\s+/i, "").charAt(0)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={recipe.title} loading={priority ? "eager" : "lazy"} />;
}

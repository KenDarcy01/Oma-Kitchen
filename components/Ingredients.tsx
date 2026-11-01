"use client";

import { useState } from "react";
import { formatAmount, type Ingredient } from "@/lib/recipe";

/** Ingredient list with a servings scaler. Shows Oma's original wording under the metric amount. */
export function Ingredients({
  ingredients,
  yieldAmount,
  yieldUnit,
}: {
  ingredients: Ingredient[];
  yieldAmount: number | null;
  yieldUnit: string | null;
}) {
  const base = yieldAmount && yieldAmount > 0 ? yieldAmount : null;
  const step = base ? (base >= 8 ? Math.round(base / 2) : 1) : 1;
  const [count, setCount] = useState(base ?? 1);
  const factor = base ? count / base : 1;
  const scaled = factor !== 1;

  return (
    <div>
      {base && (
        <div className="scaler">
          <button type="button" aria-label="Make fewer" onClick={() => setCount((c) => Math.max(step, c - step))}>−</button>
          <span aria-live="polite"><b>{count}</b> {yieldUnit ?? "servings"}</span>
          <button type="button" aria-label="Make more" onClick={() => setCount((c) => c + step)}>+</button>
        </div>
      )}
      <ul className="ing">
        {ingredients.map((ing, i) => (
          <li key={i}>
            <span>
              {ing.name}
              {ing.note && <small>{ing.note}</small>}
            </span>
            <b>
              {formatAmount(ing.amount == null ? null : ing.amount * factor, ing.unit)}
              {ing.original && !scaled && <small>{ing.original}</small>}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

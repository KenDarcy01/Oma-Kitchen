import { Suspense } from "react";
import { RecipeView } from "@/components/RecipeView";

export default function Page() {
  return (
    <Suspense>
      <RecipeView />
    </Suspense>
  );
}

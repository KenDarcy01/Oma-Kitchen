import type { Metadata } from "next";
import { AddRecipe } from "./AddRecipe";

export const metadata: Metadata = { title: "Add a recipe" };

export default function AddPage() {
  return (
    <div className="wrap">
      <AddRecipe />
    </div>
  );
}

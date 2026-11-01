import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/store";
import { PhotoStudio } from "./PhotoStudio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Photo studio" };

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) notFound();
  return (
    <div className="wrap">
      <PhotoStudio slug={recipe.slug} title={recipe.title} />
    </div>
  );
}

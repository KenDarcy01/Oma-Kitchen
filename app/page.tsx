import Link from "next/link";
import { RecipeImage } from "@/components/RecipeImage";
import { CATEGORIES, formatMinutes } from "@/lib/recipe";
import { listRecipes } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const category = CATEGORIES.find((x) => x === c);
  const recipes = await listRecipes(category);
  const featured = !category ? (recipes.find((r) => r.photo_path) ?? recipes[0]) : undefined;
  const rest = recipes.filter((r) => r !== featured);

  return (
    <div className="wrap">
      <div className="home-head">
        <div>
          <p className="small" style={{ margin: 0 }}>Hello, love! {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}{category ? ` in ${category}` : ""}</p>
          <h1>Oma&apos;s Kitchen</h1>
        </div>
        <p className="hand" style={{ fontSize: 24, margin: 0, maxWidth: 360 }}>The bakes, the puddings and the Sunday dinners.</p>
      </div>

      {featured && (
        <Link href={`/recipes/${featured.slug}`} className="hero">
          <RecipeImage recipe={featured} priority />
          <div className="over">
            <span className="tag">Latest from Oma</span>
            <b>{featured.title}</b>
            <span style={{ opacity: 0.85, fontSize: 14 }}>
              {[featured.season, formatMinutes(featured.total_minutes), featured.yield_amount && `${featured.yield_amount} ${featured.yield_unit ?? ""}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </Link>
      )}

      <nav className="cats" aria-label="Categories">
        <Link href="/" className={`pill${!category ? " on" : ""}`}>All</Link>
        {CATEGORIES.map((cat) => (
          <Link key={cat} href={`/?c=${encodeURIComponent(cat)}`} className={`pill${category === cat ? " on" : ""}`}>
            {cat}
          </Link>
        ))}
      </nav>

      {recipes.length === 0 ? (
        <div className="empty">
          <p className="hand" style={{ fontSize: 30 }}>Nothing here yet.</p>
          <Link href="/add" className="btn">Add a recipe</Link>
        </div>
      ) : (
        <div className="grid">
          {rest.map((r) => (
            <Link key={r.id} href={`/recipes/${r.slug}`} className="card">
              <div className="photo"><RecipeImage recipe={r} /></div>
              <div className="t">
                {r.title}
                <span>{[r.category, formatMinutes(r.total_minutes)].filter(Boolean).join(" · ")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

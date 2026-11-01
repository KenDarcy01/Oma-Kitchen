"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Ingredient, type RecipeDraft } from "@/lib/recipe";

type Way = "type" | "card" | "speak";

// Minimal typing for the browser's built-in dictation (Chrome, Edge, Safari).
type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
function getSpeech(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const emptyIngredient = (): Ingredient => ({ name: "", amount: null, unit: "", original: null, note: null, needs_check: false });

export function AddRecipe() {
  const router = useRouter();
  const [way, setWay] = useState<Way>("type");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  const [busy, setBusy] = useState<"tidy" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [meta, setMeta] = useState<{ original_text: string | null; card_image_path: string | null }>({ original_text: null, card_image_path: null });

  useEffect(() => setCanSpeak(Boolean(getSpeech())), []);
  useEffect(() => {
    const urls = cards.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [cards]);

  function toggleListening() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Rec = getSpeech();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = "en-IE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said) setText((t) => (t ? t.trimEnd() + " " : "") + said.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") setError("The microphone is blocked. Allow it in the browser to speak a recipe.");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function tidy() {
    setBusy("tidy");
    setError(null);
    const fd = new FormData();
    fd.set("text", text);
    cards.forEach((c) => fd.append("card", c));
    try {
      const res = await fetch("/api/tidy", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setDraft(data.draft);
      setMeta({ original_text: data.original_text, card_image_path: data.card_image_path });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError(null);
    const rest: Omit<RecipeDraft, "questions"> & { questions?: string[] } = { ...draft };
    delete rest.questions;
    const cleaned = { ...rest, ingredients: rest.ingredients.filter((i) => i.name.trim()), steps: rest.steps.filter((s) => s.trim()) };
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: cleaned, ...meta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      router.push(`/recipes/${data.slug}/photo?new=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setIng = (i: number, patch: Partial<Ingredient>) =>
    setDraft((d) => (d ? { ...d, ingredients: d.ingredients.map((x, j) => (j === i ? { ...x, ...patch, needs_check: false } : x)) } : d));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const ready = text.trim().length > 0 || cards.length > 0;

  return (
    <div className="add">
      <section className="panel" aria-labelledby="in-h">
        <h1 id="in-h" style={{ fontSize: 30 }}>Add a recipe</h1>
        <div className="ways" role="tablist" aria-label="How to add it">
          <button type="button" role="tab" aria-selected={way === "type"} className={`pill${way === "type" ? " on" : ""}`} onClick={() => setWay("type")}>Type or paste</button>
          <button type="button" role="tab" aria-selected={way === "card"} className={`pill${way === "card" ? " on" : ""}`} onClick={() => setWay("card")}>Photo of a recipe card</button>
          {canSpeak && (
            <button type="button" role="tab" aria-selected={way === "speak"} className={`pill${way === "speak" ? " on" : ""}`} onClick={() => setWay("speak")}>Speak it</button>
          )}
        </div>

        {way === "card" && (
          <label className={`drop${cards.length ? " has" : ""}`}>
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setCards(Array.from(e.target.files ?? []))} />
            {cards.length ? (
              <div className="thumbs">{previews.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`Card photo ${i + 1}`} />
            ))}</div>
            ) : (
              <>
                <b>Choose a photo of the card</b>
                <span className="small">Both sides are fine. The card is kept as a keepsake.</span>
              </>
            )}
          </label>
        )}

        {way === "speak" && (
          <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
            <button type="button" className={`btn ${listening ? "butter" : ""}`} onClick={toggleListening}>
              {listening ? "● Listening… tap to stop" : "🎙 Start talking"}
            </button>
            <span className="small">Tell it the way you&apos;d tell one of the grandchildren. What you say appears below.</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="recipe-text">{way === "card" ? "Anything to add? (optional)" : "The recipe"}</label>
          <textarea
            id="recipe-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Apple tart. 8oz plain flour, 4oz butter, pinch of salt, a little cold water…\n\nWrite it any way you like. I'll tidy it up."}
            style={way === "card" ? { minHeight: 100 } : undefined}
          />
        </div>

        <button type="button" className="btn" onClick={tidy} disabled={!ready || busy !== null}>
          {busy === "tidy" ? <><span className="spinner" /> Reading your recipe…</> : draft ? "Tidy it up again" : "✦ Tidy it up"}
        </button>
        {error && <div className="error" role="alert">{error}</div>}
      </section>

      <section className="panel" aria-labelledby="out-h" style={{ background: draft ? "#fff" : "var(--sand)" }}>
        {!draft ? (
          <div style={{ display: "grid", gap: 10, padding: "30px 0", textAlign: "center" }}>
            <h2 id="out-h" style={{ fontSize: 24 }}>Your tidy recipe appears here</h2>
            <p className="muted" style={{ margin: 0 }}>Ingredients, steps, times and oven temperature, sorted. Ounces and gas marks are kept and converted.</p>
            <p className="hand" style={{ fontSize: 24, margin: "8px 0 0" }}>Don&apos;t worry about the layout!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="ai">✦ Tidied up. Check it over</span>
              <span className="small">Draft</span>
            </div>
            <h2 id="out-h" className="sr-only" style={{ position: "absolute", left: -9999 }}>Recipe preview</h2>

            {draft.questions.length > 0 && (
              <div className="questions">
                <b style={{ fontSize: 14 }}>A couple of questions</b>
                {draft.questions.map((q, i) => <span key={i} style={{ fontSize: 15 }}>• {q}</span>)}
              </div>
            )}

            <div className="field">
              <label htmlFor="d-title">Name</label>
              <input id="d-title" type="text" value={draft.title} onChange={(e) => set("title", e.target.value)} style={{ fontFamily: "var(--font-display)", fontSize: 22 }} />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="d-cat">Category</label>
                <select id="d-cat" value={draft.category} onChange={(e) => set("category", e.target.value as RecipeDraft["category"])}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="d-season">Season or occasion</label>
                <input id="d-season" type="text" value={draft.season ?? ""} onChange={(e) => set("season", e.target.value || null)} />
              </div>
            </div>
            <div className="row3">
              <div className="field">
                <label htmlFor="d-yield">Makes</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input id="d-yield" type="number" min={1} value={draft.yield_amount ?? ""} onChange={(e) => set("yield_amount", num(e.target.value))} />
                  <input aria-label="Unit, e.g. slices" type="text" value={draft.yield_unit ?? ""} onChange={(e) => set("yield_unit", e.target.value || null)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="d-min">Total minutes</label>
                <input id="d-min" type="number" min={0} value={draft.total_minutes ?? ""} onChange={(e) => set("total_minutes", num(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="d-oven">Oven °C · Gas</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input id="d-oven" type="number" value={draft.oven_c ?? ""} onChange={(e) => set("oven_c", num(e.target.value))} />
                  <input aria-label="Gas mark" type="text" value={draft.gas_mark ?? ""} onChange={(e) => set("gas_mark", e.target.value || null)} style={{ maxWidth: 60 }} />
                </div>
              </div>
            </div>

            <div className="field">
              <span className="label">Ingredients</span>
              {draft.ingredients.map((ing, i) => (
                <div key={i} className={`ing-edit${ing.needs_check ? " check" : ""}`}>
                  <input aria-label="Ingredient" type="text" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} title={ing.original ? `Oma wrote: ${ing.original}` : undefined} />
                  <input aria-label="Amount" type="number" step="any" value={ing.amount ?? ""} onChange={(e) => setIng(i, { amount: num(e.target.value) })} />
                  <input aria-label="Unit" type="text" value={ing.unit} onChange={(e) => setIng(i, { unit: e.target.value })} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${ing.name}`} onClick={() => set("ingredients", draft.ingredients.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              {draft.ingredients.some((i) => i.needs_check) && <span className="small">Yellow amounts were guesses from things like &quot;a good handful&quot;. Change them or leave them.</span>}
              <button type="button" className="btn alt small" style={{ justifySelf: "start" }} onClick={() => set("ingredients", [...draft.ingredients, emptyIngredient()])}>+ Ingredient</button>
            </div>

            <div className="field">
              <span className="label">Method</span>
              {draft.steps.map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 6, alignItems: "start" }}>
                  <b style={{ paddingTop: 10 }}>{i + 1}.</b>
                  <textarea aria-label={`Step ${i + 1}`} value={s} style={{ minHeight: 64 }} onChange={(e) => set("steps", draft.steps.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className="icon-btn" aria-label={`Remove step ${i + 1}`} onClick={() => set("steps", draft.steps.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <button type="button" className="btn alt small" style={{ justifySelf: "start" }} onClick={() => set("steps", [...draft.steps, ""])}>+ Step</button>
            </div>

            <div className="field">
              <label htmlFor="d-tip">Oma&apos;s tip</label>
              <input id="d-tip" type="text" value={draft.tip ?? ""} onChange={(e) => set("tip", e.target.value || null)} className="hand" style={{ fontSize: 22 }} />
            </div>

            <button type="button" className="btn" onClick={save} disabled={busy !== null || !draft.title.trim()}>
              {busy === "save" ? <><span className="spinner" /> Saving…</> : "Save and add a photo"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

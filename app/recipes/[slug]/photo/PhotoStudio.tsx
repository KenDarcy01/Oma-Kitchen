"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BACKDROPS, drawBackdrop, type BackdropId } from "@/components/backdrops";

type Shape = "landscape" | "square";
type Source = { kind: "backdrop"; id: BackdropId } | { kind: "custom"; img: ImageBitmap } | { kind: "original" };

const SIZES: Record<Shape, [number, number]> = { landscape: [1600, 1200], square: [1400, 1400] };

/** Bounding box of the non-transparent pixels of a cut-out. */
function alphaBox(img: ImageBitmap) {
  const c = new OffscreenCanvas(img.width, img.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      if (data[(y * img.width + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: img.width, h: img.height };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * "Fix light & colour": a gentle grey-world white balance (takes the yellow cast off kitchen lighting)
 * plus a small lift in brightness, contrast and saturation.
 */
function fixLight(img: ImageBitmap): OffscreenCanvas {
  const c = new OffscreenCanvas(img.width, img.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const d = id.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  if (n > 0) {
    r /= n; g /= n; b /= n;
    const grey = (r + g + b) / 3;
    const strength = 0.3; // keep food warm, just not orange
    const gr = 1 + (grey / r - 1) * strength;
    const gg = 1 + (grey / g - 1) * strength;
    const gb = 1 + (grey / b - 1) * strength;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * gr);
      d[i + 1] = Math.min(255, d[i + 1] * gg);
      d[i + 2] = Math.min(255, d[i + 2] * gb);
    }
    ctx.putImageData(id, 0, 0);
  }
  const out = new OffscreenCanvas(img.width, img.height);
  const o = out.getContext("2d")!;
  o.filter = "brightness(1.06) contrast(1.08) saturate(1.14)";
  o.drawImage(c, 0, 0);
  return out;
}

export function PhotoStudio({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [cutout, setCutout] = useState<ImageBitmap | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [source, setSource] = useState<Source>({ kind: "backdrop", id: "marble" });
  const [shape, setShape] = useState<Shape>("landscape");
  const [light, setLight] = useState(true);
  const [shadow, setShadow] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function choosePhoto(file: File) {
    setError(null);
    setCutout(null);
    setBox(null);
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    setPhoto(bmp);
    setStatus("Cutting out the plate… the first time takes about 20 seconds");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, {
        model: "isnet_fp16",
        output: { format: "image/png" },
        progress: (key, cur, total) => {
          if (key.startsWith("fetch:") && total) setStatus(`Getting the photo tools ready… ${Math.round((cur / total) * 100)}%`);
          else if (key.startsWith("compute")) setStatus("Cutting out the plate…");
        },
      });
      const cut = await createImageBitmap(blob);
      setCutout(cut);
      setBox(alphaBox(cut));
      setStatus(null);
    } catch (e) {
      console.error(e);
      setStatus(null);
      setError("Couldn't cut out the background on this device. You can still use the photo as it is.");
      setSource({ kind: "original" });
    }
  }

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const [W, H] = SIZES[shape];
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    if (source.kind === "original" || !cutout || !box) {
      // cover-crop the original photo
      const img = light ? fixLight(photo) : photo;
      const s = Math.max(W / photo.width, H / photo.height);
      const w = photo.width * s, h = photo.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }

    if (source.kind === "custom") {
      const s = Math.max(W / source.img.width, H / source.img.height);
      ctx.filter = "blur(2px)";
      ctx.drawImage(source.img, (W - source.img.width * s) / 2, (H - source.img.height * s) / 2, source.img.width * s, source.img.height * s);
      ctx.filter = "none";
    } else {
      drawBackdrop(ctx, source.id, W, H);
    }

    const subject = light ? fixLight(cutout) : cutout;
    const s = Math.min((W * 0.8) / box.w, (H * 0.8) / box.h);
    const dw = box.w * s, dh = box.h * s;
    const dx = (W - dw) / 2, dy = (H - dh) / 2 + H * 0.02;

    if (shadow) {
      // soft contact shadow under the plate
      ctx.save();
      ctx.filter = `blur(${Math.round(W * 0.02)}px)`;
      ctx.fillStyle = "rgba(30,20,10,.35)";
      ctx.beginPath();
      ctx.ellipse(W / 2, dy + dh * 0.92, dw * 0.46, dh * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = "rgba(30,20,10,.28)";
      ctx.shadowBlur = W * 0.025;
      ctx.shadowOffsetY = W * 0.012;
      ctx.drawImage(subject, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(subject, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
    }
  }, [photo, cutout, box, source, shape, light, shadow]);

  useEffect(() => {
    render();
  }, [render]);

  async function pickCustomBackdrop(file: File) {
    setSource({ kind: "custom", img: await createImageBitmap(file, { imageOrientation: "from-image" }) });
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob) {
      setSaving(false);
      setError("Couldn't make the photo. Try again?");
      return;
    }
    const fd = new FormData();
    fd.set("photo", new File([blob], `${slug}.jpg`, { type: "image/jpeg" }));
    const res = await fetch(`/api/recipes/${slug}/photo`, { method: "POST", body: fd });
    if (!res.ok) {
      setSaving(false);
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save the photo.");
      return;
    }
    router.push(`/recipes/${slug}`);
    router.refresh();
  }

  return (
    <div className="studio">
      <section>
        <div className="stage">
          {photo ? (
            <canvas ref={canvasRef} aria-label={`Styled photo of ${title}`} />
          ) : (
            <label className="drop" style={{ border: 0, background: "none", padding: 40 }}>
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && choosePhoto(e.target.files[0])} />
              <span className="display" style={{ fontSize: 26 }}>Take or choose a photo</span>
              <span className="muted">Any table, any light. I&apos;ll cut out the plate and tidy it up.</span>
              <span className="btn" style={{ justifySelf: "center", marginTop: 10 }}>📷 Choose photo</span>
            </label>
          )}
          {status && (
            <div className="busy" role="status">
              <span className="spinner" style={{ justifySelf: "center" }} />
              <span>{status}</span>
            </div>
          )}
        </div>
        {photo && (
          <label className="btn alt small" style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && choosePhoto(e.target.files[0])} />
            Use a different photo
          </label>
        )}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Photo studio</p>
          <h1 style={{ fontSize: 28 }}>{title}</h1>
        </div>
        {cutout && <span className="ai" style={{ justifySelf: "start" }}>✦ Background removed</span>}

        <div className="field">
          <span className="label">Backdrop</span>
          <div className="backdrops" role="group" aria-label="Choose a backdrop">
            {BACKDROPS.map((b) => (
              <BackdropButton
                key={b.id}
                id={b.id}
                name={b.name}
                on={source.kind === "backdrop" && source.id === b.id}
                disabled={!cutout}
                onClick={() => setSource({ kind: "backdrop", id: b.id })}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className={`btn alt small${!cutout ? " disabled" : ""}`} style={source.kind === "custom" ? { outline: "3px solid var(--plum)" } : undefined}>
              <input type="file" accept="image/*" hidden disabled={!cutout} onChange={(e) => e.target.files?.[0] && pickCustomBackdrop(e.target.files[0])} />
              My own backdrop…
            </label>
            <button type="button" className="btn alt small" disabled={!photo} onClick={() => setSource({ kind: "original" })} style={source.kind === "original" ? { outline: "3px solid var(--plum)" } : undefined}>
              Keep the real background
            </button>
          </div>
        </div>

        <label className="toggle">Fix light &amp; colour <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} /></label>
        <label className="toggle">Soft shadow under the plate <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} disabled={source.kind === "original"} /></label>

        <div className="field">
          <span className="label">Shape</span>
          <div className="segmented">
            <button type="button" className={`pill${shape === "landscape" ? " on" : ""}`} onClick={() => setShape("landscape")}>Wide</button>
            <button type="button" className={`pill${shape === "square" ? " on" : ""}`} onClick={() => setShape("square")}>Square</button>
          </div>
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={save} disabled={!photo || saving || Boolean(status)}>
            {saving ? <><span className="spinner" /> Saving…</> : "Use this photo"}
          </button>
          <button type="button" className="btn alt" onClick={() => router.push(`/recipes/${slug}`)}>Skip for now</button>
        </div>
      </section>
    </div>
  );
}

function BackdropButton({ id, name, on, disabled, onClick }: { id: BackdropId; name: string; on: boolean; disabled: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 180;
    c.height = 96;
    drawBackdrop(c.getContext("2d")!, id, 180, 96);
  }, [id]);
  return (
    <button type="button" className={`bd${on ? " on" : ""}`} aria-pressed={on} onClick={onClick} disabled={disabled}>
      <canvas ref={ref} aria-hidden="true" />
      <span>{name}</span>
    </button>
  );
}

/**
 * Styled food-photo backdrops, drawn procedurally so they look the same at any size.
 * Each draws into a 2D context filling (0,0,w,h). A seeded random keeps textures stable between redraws.
 */
export type BackdropId = "marble" | "linen" | "wood" | "slate" | "gingham" | "cream";

export const BACKDROPS: { id: BackdropId; name: string }[] = [
  { id: "marble", name: "Marble" },
  { id: "linen", name: "Linen" },
  { id: "wood", name: "Wood board" },
  { id: "slate", name: "Slate" },
  { id: "gingham", name: "Tablecloth" },
  { id: "cream", name: "Plain cream" },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, id: BackdropId, w: number, h: number) {
  const r = rng(42);
  const k = Math.max(w, h) / 1000; // scale details to canvas size
  ctx.save();
  switch (id) {
    case "marble": {
      ctx.fillStyle = "#efece8";
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      g.addColorStop(0, "#f7f5f2");
      g.addColorStop(1, "#dcd6d0");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let v = 0; v < 9; v++) {
        ctx.beginPath();
        let x = r() * w * 0.3 - w * 0.1;
        let y = r() * h;
        ctx.moveTo(x, y);
        while (x < w * 1.1) {
          const nx = x + (40 + r() * 90) * k;
          const ny = y + (r() - 0.45) * 70 * k;
          ctx.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * 40 * k, (y + ny) / 2 + (r() - 0.5) * 40 * k, nx, ny);
          x = nx;
          y = ny;
        }
        ctx.strokeStyle = `rgba(150,140,135,${0.12 + r() * 0.22})`;
        ctx.lineWidth = (0.6 + r() * 2.2) * k;
        ctx.stroke();
      }
      break;
    }
    case "linen": {
      ctx.fillStyle = "#e9ddcc";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3 * k) {
        ctx.fillStyle = `rgba(160,135,100,${0.05 + r() * 0.08})`;
        ctx.fillRect(0, y, w, 1.2 * k);
      }
      for (let x = 0; x < w; x += 3.5 * k) {
        ctx.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.07})`;
        ctx.fillRect(x, 0, 1.1 * k, h);
      }
      vignette(ctx, w, h, 0.18);
      break;
    }
    case "wood": {
      const planks = 5;
      const ph = h / planks;
      for (let p = 0; p < planks; p++) {
        const base = 120 + r() * 30;
        ctx.fillStyle = `rgb(${base + 40},${base - 10},${base - 55})`;
        ctx.fillRect(0, p * ph, w, ph);
        for (let i = 0; i < 26; i++) {
          const y = p * ph + r() * ph;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 60 * k) ctx.lineTo(x, y + Math.sin(x / (120 * k) + i) * 4 * k);
          ctx.strokeStyle = `rgba(80,45,20,${0.08 + r() * 0.15})`;
          ctx.lineWidth = (0.5 + r() * 2) * k;
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(50,25,10,.35)";
        ctx.fillRect(0, p * ph, w, 2 * k);
      }
      vignette(ctx, w, h, 0.25);
      break;
    }
    case "slate": {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      g.addColorStop(0, "#565b66");
      g.addColorStop(1, "#24262c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
        ctx.fillRect(r() * w, r() * h, 1.5 * k, 1.5 * k);
      }
      break;
    }
    case "gingham": {
      ctx.fillStyle = "#f6f2ec";
      ctx.fillRect(0, 0, w, h);
      const s = 48 * k;
      ctx.fillStyle = "rgba(196,64,80,.32)";
      for (let x = 0; x < w; x += s * 2) ctx.fillRect(x, 0, s, h);
      for (let y = 0; y < h; y += s * 2) ctx.fillRect(0, y, w, s);
      vignette(ctx, w, h, 0.15);
      break;
    }
    case "cream": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#fbf6ee");
      g.addColorStop(1, "#efe4d3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

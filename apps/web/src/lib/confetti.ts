interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
}

const TOKENS = ["--color-green-600", "--color-yellow-400", "--color-green-100", "--color-ink-950"];

/** Colors come from the design tokens on the page, so confetti always matches the theme. */
function palette(): string[] {
  const style = getComputedStyle(document.documentElement);
  const found = TOKENS.map((t) => style.getPropertyValue(t).trim()).filter(Boolean);
  return found.length > 0 ? found : ["green", "gold"];
}

/**
 * A short burst of paper from a point on screen. Draws on its own canvas and removes it when done.
 * Does nothing when the person prefers reduced motion. Returns a function that stops it early.
 */
export function burstConfetti(origin?: { x: number; y: number }, count = 140): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return () => undefined;
  }
  ctx.scale(dpr, dpr);

  const colors = palette();
  const from = origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.35 };
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "gold",
      life: 1,
    };
  });

  let frame = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.remove();
  };
  const tick = () => {
    if (stopped) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of pieces) {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.0075;
      if (p.life <= 0 || p.y > window.innerHeight + 20) continue;
      alive += 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive === 0) stop();
    else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}

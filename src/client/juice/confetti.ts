// A short burst of confetti over the whole screen, drawn on a canvas that
// removes itself when the pieces have fallen. Skipped for players who ask
// for reduced motion.

import { playWinSound } from "./sfx";

const COLORS = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#457b9d", "#8338ec", "#ff006e", "#ffffff"];
const DURATION_MS = 2800;

interface Piece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  color: string; wobble: number;
}

export const fireConfetti = (): void => {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  };
  resize();
  window.addEventListener("resize", resize);

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const pieces: Piece[] = [];
  // two cannons, one in each bottom corner, aimed up and inwards
  [0, 1].forEach((side) => {
    for (let i = 0; i < 80; i++) {
      const angle = (side === 0 ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
      const speed = 9 + Math.random() * 9;
      pieces.push({
        x: side === 0 ? 0 : W(),
        y: H(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        wobble: Math.random() * Math.PI * 2,
      });
    }
  });

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.7);
    last = now;
    const elapsed = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W(), H());
    const fade = elapsed > DURATION_MS - 600 ? Math.max(0, (DURATION_MS - elapsed) / 600) : 1;
    for (const p of pieces) {
      p.vy += 0.32 * dt;
      p.vx *= Math.pow(0.985, dt);
      p.vy *= Math.pow(0.985, dt);
      p.wobble += 0.12 * dt;
      p.x += (p.vx + Math.sin(p.wobble) * 0.8) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.wobble));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener("resize", resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
};

let lastCelebratedAuction: string | null = null;

/** Confetti and a chime when this player has just won an auction (once per auction). */
export const celebrateAuctionWin = (auctionId: string): void => {
  if (lastCelebratedAuction === auctionId) {
    return;
  }
  lastCelebratedAuction = auctionId;
  fireConfetti();
  playWinSound();
};

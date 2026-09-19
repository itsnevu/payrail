"use client";

import { useEffect, useRef } from "react";

/**
 * Pointer effects for the hero, mouse only.
 *
 * - The white ground is a grid of small dots on a canvas. Dots near the pointer grow, darken and
 *   drift toward it, then spring back, so the page feels like a surface the cursor presses on.
 * - The black stage gets a specular sheen that follows the pointer and the render shifts a few
 *   pixels against it (parallax), which is what a glass object under a moving light does.
 *
 * Touch devices and prefers-reduced-motion get the static page.
 */
const GAP = 26; // px between dots
const RADIUS = 170; // px of influence
const DOT = 1.4; // resting dot radius

export default function HeroFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    const hero = canvas.closest<HTMLElement>(".lp-hero");
    const stage = hero?.querySelector<HTMLElement>(".lp-hero-art");
    if (!hero) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#0a0a0a";
    let w = 0;
    let h = 0;
    let dpr = 1;
    let dots: { x: number; y: number; ox: number; oy: number; s: number }[] = [];
    const mouse = { x: -9999, y: -9999, inside: false };
    let raf = 0;
    let idleFrames = 0;

    const resize = () => {
      const r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const ox = (w % GAP) / 2;
      const oy = (h % GAP) / 2;
      for (let y = oy; y < h; y += GAP) {
        for (let x = ox; x < w; x += GAP) dots.push({ x, y, ox: x, oy: y, s: 0 });
      }
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      let moving = false;
      for (const d of dots) {
        const dx = mouse.x - d.ox;
        const dy = mouse.y - d.oy;
        const dist = Math.hypot(dx, dy);
        // target: 0 far away, 1 under the pointer
        const t = mouse.inside && dist < RADIUS ? 1 - dist / RADIUS : 0;
        const eased = t * t * (3 - 2 * t);
        // spring toward the target; dots pull slightly toward the pointer
        d.s += (eased - d.s) * 0.16;
        const pull = d.s * 7;
        const tx = d.ox + (dist > 0 ? (dx / dist) * pull : 0);
        const ty = d.oy + (dist > 0 ? (dy / dist) * pull : 0);
        d.x += (tx - d.x) * 0.2;
        d.y += (ty - d.y) * 0.2;
        if (Math.abs(d.s - eased) > 0.002 || Math.abs(tx - d.x) > 0.05) moving = true;

        const r = DOT + d.s * 2.2;
        ctx.globalAlpha = 0.16 + d.s * 0.7;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // keep animating a few frames after everything settled, then stop burning CPU
      idleFrames = moving ? 0 : idleFrames + 1;
      raf = idleFrames < 10 ? requestAnimationFrame(draw) : 0;
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const onMove = (ev: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      mouse.x = ev.clientX - r.left;
      mouse.y = ev.clientY - r.top;
      mouse.inside = true;
      wake();
      if (stage) {
        const sr = stage.getBoundingClientRect();
        const px = (ev.clientX - sr.left) / sr.width;
        const py = (ev.clientY - sr.top) / sr.height;
        const over = px >= 0 && px <= 1 && py >= 0 && py <= 1;
        stage.style.setProperty("--px", `${(px * 100).toFixed(1)}%`);
        stage.style.setProperty("--py", `${(py * 100).toFixed(1)}%`);
        stage.style.setProperty("--sx", `${((0.5 - px) * 14).toFixed(1)}px`);
        stage.style.setProperty("--sy", `${((0.5 - py) * 10).toFixed(1)}px`);
        stage.classList.toggle("is-lit", over);
      }
    };
    const onLeave = () => {
      mouse.inside = false;
      wake();
      if (stage) {
        stage.classList.remove("is-lit");
        stage.style.setProperty("--sx", "0px");
        stage.style.setProperty("--sy", "0px");
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(hero);
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      ro.disconnect();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-hero-dots" aria-hidden="true" />;
}

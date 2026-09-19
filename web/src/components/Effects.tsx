"use client";

import { useEffect } from "react";

/**
 * Motion and material layer, mounted once in the root layout.
 *
 * - Reveal: sections, cards and tiles fade up as they enter the viewport.
 *   Elements are picked up by selector so pages need no per-element markup;
 *   anything that arrives later (client renders, route changes) is observed
 *   through a MutationObserver.
 * - Spotlight: interactive surfaces get a pointer-tracked highlight through
 *   --mx / --my (mouse only; touch devices skip it).
 * - Scroll progress: --scroll-progress on <html> drives the thin bar at the top.
 *
 * Everything is disabled under prefers-reduced-motion.
 */
const REVEAL_SELECTOR = [
  ".lp-hero-copy > *",
  ".lp-section > .lp-col",
  ".lp-section > .lp-portal",
  ".lp-tile",
  ".lp-compare-col",
  ".lp-stat",
  ".card",
  "main > *",
].join(",");

export default function Effects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("fx-ready");
    if (reduce) return;

    /* ---- reveal ---- */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const seen = new WeakSet<Element>();
    const collect = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el, i) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.classList.add("reveal");
        if (!el.style.getPropertyValue("--reveal-delay")) {
          el.style.setProperty("--reveal-delay", `${Math.min(i % 6, 5) * 60}ms`);
        }
        io.observe(el);
      });
    };
    collect(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) collect(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    /* ---- spotlight ---- */
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (ev: PointerEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".surface-interactive, .card, .lp-tilt");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width;
      const py = (ev.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      if (el.classList.contains("lp-tilt")) {
        // lean toward the pointer, at most ~5deg either way
        el.style.setProperty("--rx", `${((0.5 - py) * 10).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((px - 0.5) * 10).toFixed(2)}deg`);
      }
    };
    const onLeave = (ev: PointerEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".lp-tilt");
      if (!el || el.contains(ev.relatedTarget as Node | null)) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    if (fine) {
      document.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerout", onLeave, { passive: true });
    }

    /* ---- scroll progress ---- */
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = root.scrollHeight - window.innerHeight;
        root.style.setProperty("--scroll-progress", max > 0 ? String(window.scrollY / max) : "0");
        root.classList.toggle("is-scrolled", window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (fine) {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerout", onLeave);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <div className="fx-progress" aria-hidden="true" />;
}

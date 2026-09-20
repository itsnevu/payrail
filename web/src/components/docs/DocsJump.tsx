"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

type Option = { slug: string; title: string; section: string };

/**
 * Page picker for small screens, where the sidebar is hidden. A native select grouped by
 * section: it works with the keyboard and the screen reader for free, and navigating on change
 * is what a reader expects from it.
 */
export default function DocsJump({ options, current }: { options: Option[]; current: string }) {
  const router = useRouter();
  const id = useId();

  const sections: string[] = [];
  for (const o of options) if (!sections.includes(o.section)) sections.push(o.section);

  return (
    <div className="flex items-center gap-3 lg:hidden">
      <label htmlFor={id} className="shrink-0 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
        Page
      </label>
      <div className="min-w-0 flex-1">
        {/* The chevron comes from the global `select.input` rule, the same one the dashboard uses. */}
        <select
          id={id}
          value={current}
          onChange={(e) => router.push(`/docs/${e.target.value}`)}
          className="input h-10 truncate rounded-full py-0 pl-4 font-medium"
        >
          {sections.map((s) => (
            <optgroup key={s} label={s}>
              {options
                .filter((o) => o.section === s)
                .map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

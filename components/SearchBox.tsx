"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { search, type IndexEntry } from "@/lib/search";

let cached: Promise<IndexEntry[]> | null = null;
function loadIndex() {
  cached ??= fetch("/search-index.json").then((r) => r.json());
  return cached;
}

export default function SearchBox({ size = "large", autoFocus = false }: { size?: "large" | "small"; autoFocus?: boolean }) {
  const router = useRouter();
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) loadIndex().then(setIndex);
  }, [autoFocus]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => (index ? search(index, q) : []), [index, q]);
  const large = size === "large";
  const showList = open && q.trim().length > 0;

  function go(e: IndexEntry) {
    setOpen(false);
    router.push(e.href);
  }

  return (
    <div ref={wrap} className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search professors and courses
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder={large ? "Самат, Kevin Phillips, MATH 161, вкс 150, калк 2…" : "Search professor or course"}
        value={q}
        onFocus={() => {
          setOpen(true);
          loadIndex().then(setIndex);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={
          large
            ? "w-full rounded-2xl border-2 border-ink bg-bubble px-5 py-4 text-lg text-ink placeholder:text-muted/80 outline-none focus:border-accent sm:text-xl"
            : "w-full rounded-xl border border-line bg-bubble px-3.5 py-2 text-[15px] text-ink placeholder:text-muted outline-none focus:border-accent"
        }
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-[60vh] w-full overflow-auto rounded-2xl border border-line bg-bubble p-1.5 shadow-[0_12px_32px_-12px_rgba(23,35,31,0.35)]"
        >
          {!index && <li className="px-3 py-2.5 text-muted">Loading…</li>}
          {index && results.length === 0 && (
            <li className="px-3 py-2.5 text-muted">
              Nothing matches “{q}”. Try a surname, a first name, or a code like WCS 150.
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r);
              }}
              className={`flex cursor-pointer items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 ${
                i === active ? "bg-asked" : ""
              }`}
            >
              <span className="min-w-0">
                <span className={r.kind === "course" ? "font-display text-[15px]" : "font-medium"}>{r.label}</span>
                {r.sub && <span className="ml-2 text-sm text-muted">{r.sub}</span>}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {r.count} {r.count === 1 ? "review" : "reviews"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

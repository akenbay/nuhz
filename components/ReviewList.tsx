"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Review, Sentiment } from "@/lib/data";

type Facet = { value: string; label: string; count: number };

const DOT: Record<Sentiment, string> = { positive: "bg-good", mixed: "bg-meh", negative: "bg-bad" };
const WORD: Record<Sentiment, string> = { positive: "Positive", mixed: "Mixed", negative: "Negative" };

function formatDate(d: string) {
  if (!d) return "";
  const [y, m] = d.split("-");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${month} ${y}`;
}

function Bubble({ text, asked = false }: { text: string; asked?: boolean }) {
  const long = text.length > 520;
  const [full, setFull] = useState(!long);
  return (
    <div
      className={
        asked
          ? "max-w-[85%] rounded-2xl rounded-bl-md bg-asked px-3.5 py-2 text-[15px] text-ink/85"
          : "ml-4 max-w-[92%] rounded-2xl rounded-tl-md bg-bubble px-4 py-2.5 text-[15.5px] leading-relaxed shadow-[0_1px_0_rgba(23,35,31,0.08)] sm:ml-8"
      }
    >
      <p className={`whitespace-pre-line break-words ${full ? "" : "line-clamp-[8]"}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setFull((f) => !f)}
          className="mt-1 text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {full ? "Show less" : "Show full message"}
        </button>
      )}
    </div>
  );
}

export default function ReviewList({
  reviews,
  facets,
  facetName,
  linkFor,
}: {
  reviews: Review[];
  facets: Facet[];
  facetName: "course" | "professor";
  linkFor: Record<string, { href: string; label: string }>;
}) {
  const [facet, setFacet] = useState<string | null>(null);
  const [mood, setMood] = useState<Sentiment | null>(null);
  const [allFacets, setAllFacets] = useState(false);
  const visibleFacets = allFacets ? facets : facets.slice(0, 8);

  const shown = useMemo(
    () =>
      reviews.filter(
        (r) =>
          (!facet || (facetName === "course" ? r.course : r.professorId) === facet) && (!mood || r.sentiment === mood),
      ),
    [reviews, facet, mood, facetName],
  );

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      on ? "border-ink bg-ink text-backdrop" : "border-line bg-bubble text-ink hover:border-ink/50"
    }`;

  return (
    <section aria-label="Reviews">
      {facets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={`Filter by ${facetName}`}>
          <button type="button" className={chip(facet === null)} aria-pressed={facet === null} onClick={() => setFacet(null)}>
            All {facetName === "course" ? "courses" : "professors"}
          </button>
          {visibleFacets.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={facet === f.value}
              className={chip(facet === f.value)}
              onClick={() => setFacet(facet === f.value ? null : f.value)}
            >
              {f.label} <span className="tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
          {facets.length > 8 && (
            <button
              type="button"
              className="px-2 py-1 text-sm font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => setAllFacets((v) => !v)}
            >
              {allFacets ? "Show fewer" : `Show all ${facets.length}`}
            </button>
          )}
        </div>
      )}
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by sentiment">
        {(["positive", "mixed", "negative"] as Sentiment[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={mood === s}
            className={chip(mood === s)}
            onClick={() => setMood(mood === s ? null : s)}
          >
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${DOT[s]}`} aria-hidden />
            {WORD[s]}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-muted">No reviews match these filters. Clear one to see more.</p>}

      <ol className="space-y-9">
        {shown.map((r) => {
          const other = facetName === "course" ? r.course : r.professorId;
          const link = other ? linkFor[other] : undefined;
          return (
            <li key={r.id}>
              <div className="flex flex-col items-start gap-1.5">
                {r.question && <Bubble text={r.question} asked />}
                {r.messages.map((m, i) => (
                  <Bubble key={i} text={m.text} />
                ))}
              </div>
              <div className="ml-4 mt-2.5 max-w-[65ch] sm:ml-8">
                <p className="text-[15px] text-ink">
                  <span className={`mr-2 inline-block h-2 w-2 translate-y-[-1px] rounded-full ${DOT[r.sentiment]}`} />
                  <span className="sr-only">{WORD[r.sentiment]}: </span>
                  {r.summary}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <time dateTime={r.date}>{formatDate(r.date)}</time>
                  {link && (
                    <Link href={link.href} className="font-medium text-accent underline-offset-2 hover:underline">
                      {link.label}
                    </Link>
                  )}
                  {r.tags.length > 0 && <span>{r.tags.join(", ")}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Review, Sentiment } from "@/lib/data";

type Facet = { value: string; label: string; count: number };

const DOT: Record<Sentiment, string> = { positive: "bg-good", mixed: "bg-meh", negative: "bg-bad" };
const WORD: Record<Sentiment, string> = { positive: "Positive", mixed: "Mixed", negative: "Negative" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: string) {
  if (!d) return "";
  const [y, m] = d.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function Original({ review }: { review: Review }) {
  const text = review.messages.map((m) => m.text).join("\n\n");
  const long = text.length > 220 || text.split("\n").length > 3;
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 rounded-xl bg-asked/45 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink/80">
      {review.question && (
        <p className="mb-1 truncate text-sm text-muted" title={review.question}>
          In reply to “{review.question.replace(/\s+/g, " ")}”
        </p>
      )}
      <p className={`whitespace-pre-line break-words ${open ? "" : "line-clamp-3"}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-sm font-medium text-accent underline-offset-2 hover:underline"
          aria-expanded={open}
        >
          {open ? "Show less" : "Read full message"}
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
  const [facet, setFacet] = useState("");
  const [mood, setMood] = useState<Sentiment | "">("");

  const shown = useMemo(
    () =>
      reviews.filter(
        (r) =>
          (!facet || (facetName === "course" ? r.course : r.professorId) === facet) && (!mood || r.sentiment === mood),
      ),
    [reviews, facet, mood, facetName],
  );

  const segment = (on: boolean) =>
    `rounded-lg px-2.5 py-1 text-sm transition-colors ${on ? "bg-bubble text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <section aria-label="Reviews">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-backdrop/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {facets.length > 1 && (
          <select
            value={facet}
            onChange={(e) => setFacet(e.target.value)}
            aria-label={`Filter by ${facetName}`}
            className="max-w-[60vw] rounded-lg border border-line bg-bubble px-2.5 py-1.5 text-sm text-ink sm:max-w-xs"
          >
            <option value="">All {facetName === "course" ? "courses" : "professors"}</option>
            {facets.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} ({f.count})
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-xl bg-line/60 p-0.5" role="group" aria-label="Filter by sentiment">
          <button type="button" className={segment(mood === "")} aria-pressed={mood === ""} onClick={() => setMood("")}>
            All
          </button>
          {(["positive", "mixed", "negative"] as Sentiment[]).map((s) => (
            <button key={s} type="button" className={segment(mood === s)} aria-pressed={mood === s} onClick={() => setMood(s)}>
              {WORD[s]}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm tabular-nums text-muted">{shown.length} shown</span>
      </div>

      {shown.length === 0 && <p className="py-8 text-muted">No reviews match these filters.</p>}

      <ol>
        {shown.map((r) => {
          const other = facetName === "course" ? r.course : r.professorId;
          const link = other ? linkFor[other] : undefined;
          return (
            <li key={r.id} className="border-b border-line py-5 last:border-0">
              <div className="flex items-start gap-3">
                <span className={`mt-[0.55em] h-2 w-2 shrink-0 rounded-full ${DOT[r.sentiment]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] leading-snug text-ink">
                    <span className="sr-only">{WORD[r.sentiment]}: </span>
                    {r.summary}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                    {link && (
                      <Link href={link.href} className="text-accent underline-offset-2 hover:underline">
                        {link.label}
                      </Link>
                    )}
                    <time dateTime={r.date}>{formatDate(r.date)}</time>
                  </p>
                  <Original review={r} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

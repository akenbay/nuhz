import type { Sentiment } from "@/lib/data";

const ORDER: { key: Sentiment; label: string; color: string }[] = [
  { key: "positive", label: "positive", color: "bg-good" },
  { key: "mixed", label: "mixed", color: "bg-meh" },
  { key: "negative", label: "negative", color: "bg-bad" },
];

export default function SentimentBar({ counts }: { counts: Partial<Record<Sentiment, number>> }) {
  const total = ORDER.reduce((s, o) => s + (counts[o.key] ?? 0), 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        {ORDER.map((o) =>
          counts[o.key] ? (
            <div key={o.key} className={o.color} style={{ width: `${((counts[o.key] ?? 0) / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {ORDER.map((o) => (
          <span key={o.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${o.color}`} aria-hidden />
            <span className="tabular-nums text-ink">{counts[o.key] ?? 0}</span> {o.label}
          </span>
        ))}
      </p>
    </div>
  );
}

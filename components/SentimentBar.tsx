import type { Sentiment } from "@/lib/data";

const ORDER: { key: Sentiment; label: string; color: string }[] = [
  { key: "positive", label: "positive", color: "bg-good" },
  { key: "mixed", label: "mixed", color: "bg-meh" },
  { key: "negative", label: "negative", color: "bg-bad" },
];

export default function SentimentBar({
  counts,
  compact = false,
}: {
  counts: Partial<Record<Sentiment, number>>;
  compact?: boolean;
}) {
  const total = ORDER.reduce((s, o) => s + (counts[o.key] ?? 0), 0);
  if (!total) return null;
  const bar = (
    <div className={`flex w-full overflow-hidden rounded-full bg-line ${compact ? "h-1.5" : "h-2"}`} aria-hidden>
      {ORDER.map((o) =>
        counts[o.key] ? (
          <div key={o.key} className={o.color} style={{ width: `${((counts[o.key] ?? 0) / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
  if (compact) return bar;
  return (
    <div>
      {bar}
      <p className="mt-2 text-sm text-muted">
        {ORDER.map((o, i) => (
          <span key={o.key}>
            <span className="tabular-nums text-ink">{counts[o.key] ?? 0}</span> {o.label}
            {i < ORDER.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewList from "@/components/ReviewList";
import SearchBox from "@/components/SearchBox";
import SentimentBar from "@/components/SentimentBar";
import { courseSlug, getProfessor, isPartialName, professors, reviewsForProfessor } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return professors.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = getProfessor((await params).id);
  return p ? { title: p.name, description: `${p.reviewCount} student reviews of ${p.name} at NU.` } : {};
}

export default async function ProfessorPage({ params }: { params: Promise<{ id: string }> }) {
  const p = getProfessor((await params).id);
  if (!p) notFound();
  const list = reviewsForProfessor(p.id);
  const partial = isPartialName(p.name);

  const facetCounts = new Map<string, number>();
  for (const r of list) if (r.course) facetCounts.set(r.course, (facetCounts.get(r.course) ?? 0) + 1);
  const facets = [...facetCounts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: value, count }));
  const linkFor = Object.fromEntries(p.courses.map((c) => [c, { href: `/c/${courseSlug(c)}/`, label: c }]));

  const seen = new Set([p.name.toLowerCase()]);
  const aliases = p.aliases.filter((a) => {
    const k = a.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const pos = p.sentiment.positive ?? 0;

  return (
    <>
      <div className="mt-5">
        <SearchBox size="small" />
      </div>

      <header className="pt-10 pb-6">
        <h1 className="text-[clamp(1.9rem,6vw,2.6rem)] font-semibold leading-tight tracking-tight">{p.name}</h1>
        <p className="mt-2 text-muted">
          {list.length} {list.length === 1 ? "review" : "reviews"}
          {p.courses.length > 0 && (
            <>
              {" "}in{" "}
              {p.courses.slice(0, 4).map((c, i, arr) => (
                <span key={c}>
                  <Link href={`/c/${courseSlug(c)}/`} className="text-accent hover:underline">
                    {c}
                  </Link>
                  {i < arr.length - 1 ? ", " : ""}
                </span>
              ))}
              {p.courses.length > 4 ? ` and ${p.courses.length - 4} more` : ""}
            </>
          )}
        </p>
        {aliases.length > 0 && (
          <p className="mt-1 truncate text-sm text-muted/80" title={aliases.join(", ")}>
            Also written as {aliases.join(", ")}
          </p>
        )}
        {partial && (
          <p className="mt-4 text-sm text-muted">
            Only a first name was used for this person, so these reviews may cover more than one professor.
          </p>
        )}
      </header>

      <div className="mb-6 max-w-md">
        <p className="mb-2 font-medium">
          {list.length ? Math.round((pos / list.length) * 100) : 0}% of reviews are positive
        </p>
        <SentimentBar counts={p.sentiment} />
      </div>

      <ReviewList reviews={list} facets={facets} facetName="course" linkFor={linkFor} />
    </>
  );
}

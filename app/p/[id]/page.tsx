import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewList from "@/components/ReviewList";
import SearchBox from "@/components/SearchBox";
import SentimentBar from "@/components/SentimentBar";
import { courseSlug, getProfessor, isPartialName, professors, reviewsForProfessor, topTags } from "@/lib/data";

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
  const tags = topTags(list);
  const seen = new Set([p.name.toLowerCase()]);
  const aliases = p.aliases.filter((a) => {
    const k = a.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <>
      <div className="mt-6 max-w-sm">
        <SearchBox size="small" />
      </div>
      <header className="pt-12 pb-8">
        <h1 className="font-display text-[clamp(2rem,7vw,3.5rem)] font-bold leading-[1.02] break-words">{p.name}</h1>
        {aliases.length > 0 && (
          <p className="mt-3 max-w-[60ch] text-muted">Also written as {aliases.slice(0, 8).join(", ")}</p>
        )}
        {partial && (
          <p className="mt-4 max-w-[60ch] rounded-xl bg-asked px-4 py-3 text-[15px]">
            People only wrote a first name here, so this page may mix up more than one person with the same name.
            Check the course on each review.
          </p>
        )}
      </header>

      <section className="grid gap-8 border-y border-line py-7 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="mb-3 text-base font-semibold">
            {list.length} {list.length === 1 ? "review" : "reviews"}
          </h2>
          <SentimentBar counts={p.sentiment} />
        </div>
        <div className="space-y-5">
          {p.courses.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold">Courses</h2>
              <p className="flex flex-wrap gap-2">
                {p.courses.map((c) => (
                  <Link key={c} href={`/c/${courseSlug(c)}/`} className="font-display text-sm font-semibold text-accent hover:underline">
                    {c}
                  </Link>
                ))}
              </p>
            </div>
          )}
          {tags.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold">What comes up</h2>
              <p className="text-[15px] text-muted">
                {tags.map(([t, n], i) => (
                  <span key={t}>
                    <span className="text-ink">{t}</span> <span className="tabular-nums">{n}</span>
                    {i < tags.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-8">
        <ReviewList reviews={list} facets={facets} facetName="course" linkFor={linkFor} />
      </div>
    </>
  );
}

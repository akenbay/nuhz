import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewList from "@/components/ReviewList";
import SearchBox from "@/components/SearchBox";
import SentimentBar from "@/components/SentimentBar";
import { courses, courseSlug, getCourse, getProfessor, reviewsForCourse, topTags } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return courses.map((c) => ({ slug: courseSlug(c.code) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCourse((await params).slug);
  return c ? { title: c.code, description: `${c.reviewCount} student reviews of ${c.code} at NU.` } : {};
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCourse((await params).slug);
  if (!c) notFound();
  const list = reviewsForCourse(c.code);
  const counts = new Map<string, number>();
  for (const r of list) if (r.professorId) counts.set(r.professorId, (counts.get(r.professorId) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const facets = ranked.map(([id, count]) => ({ value: id, label: getProfessor(id)?.name ?? id, count }));
  const linkFor = Object.fromEntries(ranked.map(([id]) => [id, { href: `/p/${id}/`, label: getProfessor(id)?.name ?? id }]));
  const generalCount = list.filter((r) => !r.professorId).length;
  const tags = topTags(list);
  const sameDept = courses.filter((x) => x.dept === c.dept && x.code !== c.code).slice(0, 8);

  return (
    <>
      <div className="mt-6 max-w-sm">
        <SearchBox size="small" />
      </div>
      <header className="pt-12 pb-8">
        <h1 className="font-display text-[clamp(3rem,13vw,6rem)] font-bold leading-none">{c.code}</h1>
      </header>

      <section className="grid gap-8 border-y border-line py-7 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="mb-3 text-base font-semibold">
            {list.length} {list.length === 1 ? "review" : "reviews"}
            {generalCount > 0 && <span className="font-normal text-muted">, {generalCount} about the course itself</span>}
          </h2>
          <SentimentBar counts={c.sentiment} />
          {tags.length > 0 && (
            <p className="mt-5 text-[15px] text-muted">
              {tags.map(([t, n], i) => (
                <span key={t}>
                  <span className="text-ink">{t}</span> <span className="tabular-nums">{n}</span>
                  {i < tags.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
        </div>
        {ranked.length > 0 && (
          <div>
            <h2 className="mb-2 text-base font-semibold">Professors mentioned</h2>
            <ul>
              {ranked.slice(0, 10).map(([id, n]) => {
                const p = getProfessor(id);
                if (!p) return null;
                const s = p.sentiment;
                const tot = (s.positive ?? 0) + (s.mixed ?? 0) + (s.negative ?? 0);
                return (
                  <li key={id} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
                    <Link href={`/p/${id}/`} className="font-medium hover:text-accent">
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {n} here, {tot ? Math.round(((s.positive ?? 0) / tot) * 100) : 0}% positive overall
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-8">
        <ReviewList reviews={list} facets={facets} facetName="professor" linkFor={linkFor} />
      </div>

      {sameDept.length > 0 && (
        <section className="mt-16 border-t border-line pt-6">
          <h2 className="text-base font-semibold">Other {c.dept} courses</h2>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {sameDept.map((x) => (
              <Link key={x.code} href={`/c/${courseSlug(x.code)}/`} className="font-display text-sm font-semibold text-accent hover:underline">
                {x.code}
              </Link>
            ))}
          </p>
        </section>
      )}
    </>
  );
}

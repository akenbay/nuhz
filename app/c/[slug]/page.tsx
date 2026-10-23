import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewList from "@/components/ReviewList";
import SearchBox from "@/components/SearchBox";
import SentimentBar from "@/components/SentimentBar";
import { courses, courseSlug, getCourse, getProfessor, reviewsForCourse, type Sentiment } from "@/lib/data";

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

  // Per-professor sentiment within this course only.
  const byProf = new Map<string, Partial<Record<Sentiment, number>>>();
  for (const r of list) {
    if (!r.professorId) continue;
    const s = byProf.get(r.professorId) ?? {};
    s[r.sentiment] = (s[r.sentiment] ?? 0) + 1;
    byProf.set(r.professorId, s);
  }
  const total = (s: Partial<Record<Sentiment, number>>) => (s.positive ?? 0) + (s.mixed ?? 0) + (s.negative ?? 0);
  const ranked = [...byProf.entries()].sort((a, b) => total(b[1]) - total(a[1]));
  const facets = ranked.map(([id, s]) => ({ value: id, label: getProfessor(id)?.name ?? id, count: total(s) }));
  const linkFor = Object.fromEntries(ranked.map(([id]) => [id, { href: `/p/${id}/`, label: getProfessor(id)?.name ?? id }]));
  const sameDept = courses.filter((x) => x.dept === c.dept && x.code !== c.code && /\d/.test(x.code)).slice(0, 10);

  return (
    <>
      <div className="mt-5">
        <SearchBox size="small" />
      </div>

      <header className="pt-10 pb-6">
        <h1 className="text-[clamp(2.2rem,8vw,3.2rem)] font-semibold leading-none tracking-tight">{c.code}</h1>
        <p className="mt-3 text-muted">
          {list.length} {list.length === 1 ? "review" : "reviews"}, {ranked.length}{" "}
          {ranked.length === 1 ? "professor" : "professors"} mentioned
        </p>
      </header>

      {ranked.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 font-medium">Professors</h2>
          <ul>
            {ranked.slice(0, 8).map(([id, s]) => {
              const p = getProfessor(id);
              if (!p) return null;
              const n = total(s);
              return (
                <li key={id}>
                  <Link
                    href={`/p/${id}/`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 border-b border-line py-2.5 hover:text-accent sm:grid-cols-[1fr_8rem_auto]"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                      <SentimentBar counts={s} compact />
                    </span>
                    <span className="text-sm tabular-nums text-muted">
                      {n} {n === 1 ? "review" : "reviews"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {ranked.length > 8 && (
            <p className="mt-2 text-sm text-muted">{ranked.length - 8} more in the filter below.</p>
          )}
        </section>
      )}

      <ReviewList reviews={list} facets={facets} facetName="professor" linkFor={linkFor} />

      {sameDept.length > 0 && (
        <section className="mt-14 text-sm">
          <h2 className="mb-2 text-muted">Other {c.dept} courses</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {sameDept.map((x) => (
              <Link key={x.code} href={`/c/${courseSlug(x.code)}/`} className="text-accent hover:underline">
                {x.code}
              </Link>
            ))}
          </p>
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { courses, courseSlug, isPartialName, professors, reviews } from "@/lib/data";

export default function Home() {
  const topCourses = courses.filter((c) => /\d/.test(c.code)).slice(0, 18);
  const topProfs = professors.filter((p) => !isPartialName(p.name)).slice(0, 12);

  return (
    <>
      <section className="pt-16 pb-14 sm:pt-24">
        <h1 className="font-display text-[clamp(3rem,11vw,6.5rem)] font-bold leading-[0.95]">Кого брать?</h1>
        <p className="mt-5 max-w-[52ch] text-lg text-muted">
          {reviews.length.toLocaleString("en")} reviews of {professors.length} professors and {courses.length} courses,
          pulled from the Prof. Evaluation chat. Search in English or Russian.
        </p>
        <div className="mt-8">
          <SearchBox autoFocus />
        </div>
      </section>

      <section className="border-t border-line pt-8">
        <h2 className="text-base font-semibold">Most discussed courses</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {topCourses.map((c) => (
            <li key={c.code}>
              <Link
                href={`/c/${courseSlug(c.code)}/`}
                className="inline-flex items-baseline gap-2 rounded-xl border border-line bg-bubble px-3 py-2 hover:border-ink/50"
              >
                <span className="font-display text-sm font-semibold">{c.code}</span>
                <span className="text-sm tabular-nums text-muted">{c.reviewCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold">Most discussed professors</h2>
        <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {topProfs.map((p) => (
            <li key={p.id} className="border-b border-line">
              <Link href={`/p/${p.id}/`} className="flex items-baseline justify-between gap-3 py-3 hover:text-accent">
                <span className="font-medium">{p.name}</span>
                <span className="shrink-0 text-sm text-muted">
                  {p.courses.slice(0, 2).join(", ")}
                  <span className="ml-3 tabular-nums">{p.reviewCount}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

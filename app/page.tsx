import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { courses, courseSlug, isPartialName, professors, reviews } from "@/lib/data";

export default function Home() {
  const topCourses = courses.filter((c) => /\d/.test(c.code)).slice(0, 12);
  const topProfs = professors.filter((p) => !isPartialName(p.name)).slice(0, 10);

  return (
    <>
      <section className="pt-14 pb-12 sm:pt-20">
        <h1 className="font-display text-[clamp(2.4rem,8vw,4.25rem)] font-bold leading-none">Кого брать?</h1>
        <p className="mt-4 max-w-[50ch] text-muted">
          {reviews.length.toLocaleString("en")} student reviews from the Prof. Evaluation chat. Search by professor or
          course, in English or Russian.
        </p>
        <div className="mt-7">
          <SearchBox autoFocus />
        </div>
      </section>

      <div className="grid gap-10 sm:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="mb-2 font-medium">Popular courses</h2>
          <ul>
            {topCourses.map((c) => (
              <li key={c.code}>
                <Link
                  href={`/c/${courseSlug(c.code)}/`}
                  className="flex justify-between border-b border-line py-2 hover:text-accent"
                >
                  <span>{c.code}</span>
                  <span className="text-sm tabular-nums text-muted">{c.reviewCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-medium">Most reviewed professors</h2>
          <ul>
            {topProfs.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}/`} className="flex justify-between gap-3 border-b border-line py-2 hover:text-accent">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{p.reviewCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

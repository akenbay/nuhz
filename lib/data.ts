import raw from "@/data/site_data.json";

export type Sentiment = "positive" | "mixed" | "negative";

export type Professor = {
  id: string;
  name: string;
  aliases: string[];
  courses: string[];
  sentiment: Partial<Record<Sentiment, number>>;
  reviewCount: number;
};

export type Course = {
  code: string;
  dept: string;
  professors: string[];
  sentiment: Partial<Record<Sentiment, number>>;
  reviewCount: number;
};

export type Review = {
  id: number;
  professorId: string | null;
  course: string | null;
  date: string;
  sentiment: Sentiment;
  tags: string[];
  summary: string;
  question: string | null;
  messages: { date: string; text: string }[];
};

type SiteData = { professors: Professor[]; courses: Course[]; reviews: Review[] };
const data = raw as SiteData;

export const professors = data.professors;
export const courses = data.courses;
export const reviews = data.reviews;

const profById = new Map(professors.map((p) => [p.id, p]));
const courseBySlug = new Map(courses.map((c) => [courseSlug(c.code), c]));

export function courseSlug(code: string) {
  return code.toLowerCase().replace(/\s+/g, "-");
}

export function getProfessor(id: string) {
  return profById.get(id);
}

export function getCourse(slug: string) {
  return courseBySlug.get(slug);
}

export function reviewsForProfessor(id: string) {
  return reviews.filter((r) => r.professorId === id);
}

export function reviewsForCourse(code: string) {
  return reviews.filter((r) => r.course === code);
}

/** Names like "Aigerim (MATH)" come from first-name-only mentions. */
export function isPartialName(name: string) {
  return /\([A-Z]{2,5}\)$/.test(name);
}

export function topTags(list: Review[], n = 6) {
  const counts = new Map<string, number>();
  for (const r of list) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function profName(id: string | null) {
  return id ? profById.get(id)?.name ?? null : null;
}

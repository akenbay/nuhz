import { courses, courseSlug, professors } from "@/lib/data";
import { fold, type IndexEntry } from "@/lib/search";

export const dynamic = "force-static";

export function GET() {
  const index: IndexEntry[] = [
    ...professors.map((p) => ({
      kind: "professor" as const,
      href: `/p/${p.id}/`,
      label: p.name,
      sub: p.courses.slice(0, 3).join(", "),
      count: p.reviewCount,
      keys: [...new Set([p.name.replace(/\s*\([A-Z]+\)$/, ""), ...p.aliases].map(fold))],
    })),
    ...courses.map((c) => ({
      kind: "course" as const,
      href: `/c/${courseSlug(c.code)}/`,
      label: c.code,
      sub: `${c.professors.length} professors`,
      count: c.reviewCount,
      keys: [c.code],
    })),
  ];
  return Response.json(index);
}

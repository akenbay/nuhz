// Search helpers shared by the server (building the index) and the browser (matching).

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

/** Lowercase, Latin, loosely spelled: "Самат" and "Samat" both become "samat". */
export function fold(s: string) {
  let out = "";
  for (const ch of s.toLowerCase()) out += TRANSLIT[ch] ?? ch;
  return out
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/kh/g, "h")
    .replace(/[cq]/g, "k")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Student slang for courses and departments.
const SLANG: [RegExp, string][] = [
  [/^(калк|calc|kalk)\s*1$/i, "MATH 161"],
  [/^(калк|calc|kalk)\s*2$/i, "MATH 162"],
  [/^(линал|линейка|linal)$/i, "MATH 273"],
  [/^(диффуры|ode)$/i, "MATH 274"],
  [/^дискретка$/i, "MATH 251"],
  [/^(генкем|genchem)$/i, "CHEM 101"],
  [/^(хок|хст)$/i, "HST"],
  [/^этика$/i, "PHIL 210"],
  [/^микро$/i, "ECON 101"],
  [/^макро$/i, "ECON 102"],
];
const DEPT_RU: Record<string, string> = {
  вкс: "WCS", каз: "KAZ", экон: "ECON", хст: "HST", хок: "HST", биол: "BIOL", физ: "PHYS",
  мат: "MATH", мас: "MATH", фил: "PHIL", плс: "PLS", линг: "LING", соц: "SOC", ант: "ANT",
  кс: "CSCI", ксс: "CSCI", хим: "CHEM",
};

/** If the query looks like a course ("math161", "вкс 150", "калк 2"), return its code prefix. */
export function courseQuery(q: string): string | null {
  const t = q.trim();
  for (const [re, code] of SLANG) if (re.test(t)) return code;
  const m = t.match(/^([a-zа-яё]{2,5})\s*-?\s*(\d{0,3})$/i);
  if (!m) return null;
  const dept = DEPT_RU[m[1].toLowerCase()] ?? (/^[a-z]+$/i.test(m[1]) ? m[1].toUpperCase() : null);
  if (!dept) return null;
  return m[2] ? `${dept} ${m[2]}` : dept;
}

export type IndexEntry = {
  kind: "professor" | "course";
  href: string;
  label: string;
  sub: string;
  count: number;
  keys: string[]; // folded name variants, or course code
};

export function search(index: IndexEntry[], q: string, limit = 12): IndexEntry[] {
  const query = q.trim();
  if (!query) return [];
  const code = courseQuery(query);
  const fq = fold(query);
  const scored: [number, IndexEntry][] = [];

  for (const e of index) {
    let score = 0;
    if (e.kind === "course") {
      if (code && e.label.startsWith(code)) score = e.label === code ? 100 : 80;
    } else if (fq.length >= 2) {
      for (const key of e.keys) {
        if (key === fq) score = Math.max(score, 90);
        else if (key.startsWith(fq)) score = Math.max(score, 70);
        else if (key.split(" ").some((w) => w.startsWith(fq))) score = Math.max(score, 60);
        else if (fq.length >= 4 && key.includes(fq)) score = Math.max(score, 40);
      }
    }
    if (score) scored.push([score + Math.min(e.count, 60) / 10, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, e]) => e);
}

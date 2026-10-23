#!/usr/bin/env python3
"""
Merge professor name variants and export the JSON the website reads.

"Самат", "Samat" and "Samat Kassabek" become one professor; "Капрару" and
"Mihnea Capraru" too. First-name-only mentions are attached to a full name
only when that is unambiguous (the same first name in the same course or
department). Otherwise they stay as their own entry, labelled with the
department, e.g. "Aigerim (ECON)".

Usage:
  python merge_and_export.py tagged.jsonl -o site_data.json
  # check names.csv, fix the "canonical" column where it's wrong, then:
  python merge_and_export.py tagged.jsonl -o site_data.json --aliases names.csv

names.csv has one row per raw spelling. Edit the canonical column to merge
or split people; write DROP to remove a name that isn't a person.
"""
import argparse
import csv
import json
import os
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh",
    "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    "ә": "a", "ғ": "g", "қ": "k", "ң": "n", "ө": "o", "ұ": "u", "ү": "u", "һ": "h", "і": "i",
}
NOT_NAMES = {
    "проф", "профы", "профессор", "препод", "prof", "professor", "ta", "та", "тa", "он", "она",
    "все", "all", "lecturer", "instructor", "апай", "агай", "apai", "agai", "teacher", "tutor",
    "апайка", "агайка", "апайки", "брала", "брал", "добрая", "добрый", "новый", "новая", "н/a", "а",
}
HONORIFICS = re.compile(r"\b(apai|agai|апай|агай|prof\.?|dr\.?|professor|mr\.?|ms\.?|mrs\.?)\b", re.I)
RUS_CASE_ENDINGS = ("ой", "ом", "ым", "ем", "ей", "ую", "а", "у", "ю", "я", "е")


def translit(s):
    return "".join(TRANSLIT.get(ch, TRANSLIT.get(ch.lower(), ch)) if ch.lower() in TRANSLIT else ch
                   for ch in s)


def tokens(name):
    name = HONORIFICS.sub(" ", name)
    name = re.sub(r"[-_](a|у|а|ом|ым|ей)$", "", name)          # Swider-a
    raw = re.findall(r"[^\W\d_]+", translit(name).lower())
    return [t for t in raw if len(t) > 1]


def phonetic(tok):
    """Rough key so Капрару/Capraru, Kassabek/Kasabek, Yermek/Ermek compare equal."""
    t = tok.lower()
    for a, b in (("kh", "h"), ("c", "k"), ("kh", "h"), ("q", "k"), ("x", "ks"), ("w", "v"), ("y", "i"),
                 ("j", "zh"), ("ph", "f"), ("th", "t"), ("ye", "e"), ("yu", "u"), ("ya", "a")):
        t = t.replace(a, b)
    t = re.sub(r"(.)\1+", r"\1", t)
    return t


def same_token(a, b):
    pa, pb = phonetic(a), phonetic(b)
    if pa == pb:
        return True
    # Russian case endings: Самата, Бектеля, Мельникова
    for e in ("a", "u", "om", "im", "oi", "ei", "e"):
        if pa.endswith(e) and pa[: -len(e)] == pb or pb.endswith(e) and pb[: -len(e)] == pa:
            return True
    return len(pa) >= 5 and SequenceMatcher(None, pa, pb).ratio() >= 0.83


def dept(course):
    return course.split()[0] if course else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tagged")
    ap.add_argument("-o", "--out", default="site_data.json")
    ap.add_argument("--names", default="names.csv", help="Where to write the name mapping for review")
    ap.add_argument("--aliases", help="Edited names.csv to apply (overrides automatic merging)")
    a = ap.parse_args()

    threads = [json.loads(l) for l in open(a.tagged, encoding="utf-8")]

    # ---- collect raw mentions --------------------------------------------------------------
    mentions = []  # (raw_name, course, thread, review)
    for t in threads:
        for r in t["reviews"]:
            mentions.append((r.get("professor"), r.get("course"), t, r))

    raw_count = Counter(m[0] for m in mentions if m[0])
    raw_courses = defaultdict(Counter)
    for raw, course, _, _ in mentions:
        if raw and course:
            raw_courses[raw][course] += 1

    # ---- build canonical people from full names (2+ tokens) -------------------------------
    people = []  # each: {"tokens": [...], "spellings": Counter, "courses": Counter}

    def find_full(toks):
        for p in people:
            if len(toks) == len(p["tokens"]) and all(same_token(x, y) for x, y in zip(toks, p["tokens"])):
                return p
            # "Thomas Carl Hughes" vs "Carl Thomas Hughes" vs "Thomas Hughes": same set of first+last
            if {phonetic(toks[0]), phonetic(toks[-1])} <= {phonetic(x) for x in p["tokens"]} or \
               {phonetic(p["tokens"][0]), phonetic(p["tokens"][-1])} <= {phonetic(x) for x in toks}:
                return p
        return None

    mapping = {}
    for raw, n in raw_count.most_common():
        toks = tokens(raw)
        if len(toks) < 2 or raw.lower().strip() in NOT_NAMES:
            continue
        p = find_full(toks)
        if not p:
            p = {"tokens": toks, "spellings": Counter(), "courses": Counter()}
            people.append(p)
        p["spellings"][raw] += n
        p["courses"].update(raw_courses[raw])
        mapping[raw] = p

    # ---- merge full-name duplicates ------------------------------------------------------
    # "Майкл Бектель" / "Michael Bechtel", "Dana Kopbaeva" / "Diana Kopbayeva", and one-off
    # wrong first names ("Aleksey Melnikov" once, next to "Andrey Melnikov" many times).
    def total(p):
        return sum(p["spellings"].values())

    def depts(p):
        return {dept(c) for c in p["courses"]}

    def surname_match(p, q):
        """Surnames match; also allows reversed order like "Kassabek Samat"."""
        if len(p["tokens"]) < 2 or len(q["tokens"]) < 2:
            return False
        pl, pf, ql, qf = p["tokens"][-1], p["tokens"][0], q["tokens"][-1], q["tokens"][0]
        if len(pl) >= 4 and same_token(pl, ql):
            return True
        # Reversed order needs an exact (phonetic) match to avoid "Хашим Али" ~ "Aliya ..."
        def rev(x, y):
            return phonetic(x) == phonetic(y) or (min(len(x), len(y)) >= 6 and same_token(x, y))
        return rev(pl, qf) or rev(pf, ql)

    def absorb(big, small):
        big["spellings"].update(small["spellings"])
        big["courses"].update(small["courses"])
        for raw in small["spellings"]:
            mapping[raw] = big
        people.remove(small)

    changed = True
    while changed:
        changed = False
        for small in sorted(people, key=total):
            for big in sorted(people, key=total, reverse=True):
                if big is small or not surname_match(big, small):
                    continue
                if depts(big) and depts(small) and not (depts(big) & depts(small)):
                    continue
                firsts = [phonetic(t) for t in (big["tokens"][0], small["tokens"][0])]
                rest_big = {phonetic(t) for t in big["tokens"]}
                rest_small = {phonetic(t) for t in small["tokens"]}
                similar_first = SequenceMatcher(None, *firsts).ratio() >= 0.6 or \
                    any(SequenceMatcher(None, a_, b_).ratio() >= 0.6
                        for a_ in rest_big - rest_small for b_ in rest_small - rest_big)
                tiny = total(small) <= 2 and total(big) >= 3 * total(small) and \
                    phonetic(big["tokens"][-1]) == phonetic(small["tokens"][-1]) and \
                    bool(depts(big) & depts(small))
                if similar_first or tiny:
                    absorb(big, small)
                    changed = True
                    break
            if changed:
                break

    # ---- attach single-token mentions (first name or surname) ------------------------------
    singles = {}
    for raw, n in raw_count.most_common():
        if raw in mapping:
            continue
        toks = tokens(raw)
        if not toks or raw.lower().strip() in NOT_NAMES or (len(toks) == 1 and toks[0] in NOT_NAMES):
            mapping[raw] = None
            continue
        tok = toks[-1] if len(toks) > 1 else toks[0]
        cands = [p for p in people if any(same_token(tok, x) for x in p["tokens"])]
        my_courses = set(raw_courses[raw])
        my_depts = {dept(c) for c in my_courses}
        if my_courses:
            # Keep only candidates teaching in the same department (when we know theirs).
            cands = [p for p in cands if not p["courses"] or my_depts & {dept(c) for c in p["courses"]}]
            by_course = [p for p in cands if my_courses & set(p["courses"])]
            if len(by_course) == 1:
                cands = by_course
        if len(cands) > 1:
            # One clearly dominant person wins ("Мельников" -> Andrey Melnikov, not a one-off typo).
            cands.sort(key=lambda p: -sum(p["spellings"].values()))
            if sum(cands[0]["spellings"].values()) >= 3 * sum(sum(p["spellings"].values()) for p in cands[1:]):
                cands = cands[:1]
        if len(cands) == 1:
            cands[0]["spellings"][raw] += n
            cands[0]["courses"].update(raw_courses[raw])
            mapping[raw] = cands[0]
            continue
        # Own entry. Split an ambiguous first name by department so two Aigerims don't merge.
        main_dept = Counter(dept(c) for c in raw_courses[raw].elements()).most_common(1)
        key = (phonetic(tok), main_dept[0][0] if main_dept else None)
        if key not in singles:
            singles[key] = {"tokens": [tok], "spellings": Counter(), "courses": Counter(), "single": True}
            people.append(singles[key])
        singles[key]["spellings"][raw] += n
        singles[key]["courses"].update(raw_courses[raw])
        mapping[raw] = singles[key]

    # ---- display names ---------------------------------------------------------------------
    def display(p):
        latin = [s for s, _ in p["spellings"].most_common() if not re.search("[а-яёәғқңөұүһі]", s, re.I)]
        full_latin = [x for x in latin if len(tokens(x)) >= 2]
        pool = full_latin or latin
        best = max(pool, key=lambda s: (p["spellings"][s], len(tokens(s)))) if pool else None
        if not best:
            cyr = max(p["spellings"], key=lambda s: (len(tokens(s)), p["spellings"][s]))
            best = " ".join(w.capitalize() for w in tokens(cyr))
        best = HONORIFICS.sub("", best).strip(" ,.")
        best = " ".join(w if w[:1].isupper() else w.capitalize() for w in best.split())
        if p.get("single"):
            d = Counter(dept(c) for c in p["courses"].elements()).most_common(1)
            if d:
                best = f"{best} ({d[0][0]})"
        return best

    canon_of = {raw: (display(p) if p else "DROP") for raw, p in mapping.items()}

    # ---- manual overrides -----------------------------------------------------------------
    if a.aliases and os.path.exists(a.aliases):
        with open(a.aliases, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                if row.get("raw") and row.get("canonical"):
                    canon_of[row["raw"]] = row["canonical"].strip()

    with open(a.names, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["canonical", "raw", "mentions", "courses"])
        for raw in sorted(canon_of, key=lambda r: (canon_of[r], -raw_count[r])):
            w.writerow([canon_of[raw], raw, raw_count[raw],
                        " ".join(c for c, _ in raw_courses[raw].most_common(4))])

    # ---- export ---------------------------------------------------------------------------
    def slug(s):
        return re.sub(r"[^a-z0-9]+", "-", translit(s).lower()).strip("-")

    profs, courses, reviews = {}, {}, []
    for i, (raw, course, t, r) in enumerate(mentions):
        name = canon_of.get(raw) if raw else None
        if name == "DROP":
            name = None
        if not name and not course:
            continue
        pid = slug(name) if name else None
        if pid:
            p = profs.setdefault(pid, {"id": pid, "name": name, "aliases": set(), "courses": Counter(),
                                       "sentiment": Counter(), "reviewCount": 0})
            p["aliases"].add(raw)
            p["sentiment"][r["sentiment"]] += 1
            p["reviewCount"] += 1
            if course:
                p["courses"][course] += 1
        if course:
            c = courses.setdefault(course, {"code": course, "dept": dept(course), "professors": Counter(),
                                            "sentiment": Counter(), "reviewCount": 0})
            c["sentiment"][r["sentiment"]] += 1
            c["reviewCount"] += 1
            if pid:
                c["professors"][pid] += 1

        texts = {m["id"]: m for m in t["messages"]}
        cited = [texts[x] for x in r["message_ids"] if x in texts]
        root = t["messages"][0]
        question = root["text"] if root["id"] not in r["message_ids"] and len(t["messages"]) > 1 else None
        reviews.append({
            "id": i,
            "professorId": pid,
            "course": course,
            "date": (cited[0]["date"] if cited else t["date"] or "")[:10],
            "sentiment": r["sentiment"],
            "tags": r["tags"],
            "summary": r["summary"],
            "question": question,
            "messages": [{"date": (m["date"] or "")[:10], "text": m["text"]} for m in cited],
        })

    for p in profs.values():
        p["aliases"] = sorted(x for x in p["aliases"] if x and x != p["name"])
        p["courses"] = [c for c, _ in p["courses"].most_common()]
        p["sentiment"] = dict(p["sentiment"])
    for c in courses.values():
        c["professors"] = [x for x, _ in c["professors"].most_common()]
        c["sentiment"] = dict(c["sentiment"])

    data = {
        "professors": sorted(profs.values(), key=lambda p: -p["reviewCount"]),
        "courses": sorted(courses.values(), key=lambda c: -c["reviewCount"]),
        "reviews": sorted(reviews, key=lambda r: r["date"], reverse=True),
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"{len(raw_count)} raw names -> {len(profs)} professors; {len(courses)} courses; "
          f"{len(reviews)} reviews")
    print(f"Name mapping for review: {a.names}.  Site data: {a.out}")


if __name__ == "__main__":
    main()

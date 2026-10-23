#!/usr/bin/env python3
"""
Tag each thread with the professors and courses it reviews, using Claude.

Input:  threads.jsonl from build_threads.py
Output: tagged.jsonl  (one line per thread, resumable: rerun to continue)
        reviews.csv   (one row per review, for checking and fixing in Excel/Sheets)

Usage:
  # with Claude
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...
  # or with OpenAI
  pip install openai
  export OPENAI_API_KEY=sk-...
  python tag_threads.py threads.jsonl --provider openai --model <cheap model, e.g. gpt-4o-mini> --limit 50

  python tag_threads.py threads.jsonl --dry-run          # print one prompt, no API call
  python tag_threads.py threads.jsonl --limit 50         # test on 50 threads first
  python tag_threads.py threads.jsonl                    # full run
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

DEFAULT_MODELS = {"anthropic": "claude-haiku-5-5", "openai": "gpt-4o-mini"}

# Student slang to course codes. Check these against the NU catalog and extend.
NICKNAMES = """
калк 1 / calc 1 = MATH 161;  калк 2 / calc 2 = MATH 162
линал / линейка / linal = MATH 273;  диффуры / ODE = MATH 274;  дискретка = MATH 251
генкем / genchem = CHEM 101;  микро = ECON 101;  макро = ECON 102;  этика = PHIL 210
хок / хст / history of kazakhstan = HST 100;  риторика = WCS
Department prefixes: вкс / wcs = WCS (never "WKS"), каз = KAZ, экон = ECON, хст / хок = HST,
биол = BIOL, физ = PHYS, мат / мас = MATH, фил = PHIL, плс / pks = PLS, линг = LING,
соц = SOC, ант = ANT, кс / ксс = CSCI, смг = SMG, хим = CHEM
"""

TAGS = ["easy", "hard", "fair grading", "harsh grading", "generous grading", "good lecturer",
        "bad lecturer", "heavy workload", "light workload", "attendance strict",
        "attendance relaxed", "interesting", "boring", "helpful", "strict", "chill"]

SYSTEM = f"""You extract professor and course reviews from a Nazarbayev University student chat.
Messages are in Russian, English, Kazakh or a mix, with heavy slang and swearing.

You get several threads. Each message has an id in brackets; indentation shows reply depth.
For each thread, read EVERY message, including deep replies, and extract every opinion about
a professor, a course, or a professor in a course.

What counts as a review:
- Any evaluative statement, however short: "лучший", "норм", "дно", "вышка", "душнила",
  "жесткий керв", "изи А", "не бери", "берите Халита". Short answers to a question ARE reviews.
- Recommendations and warnings: "берите Бектеля, Халита или Мейрамгуль" is a positive review
  of each of the three. "Диану не бери" is a negative review of Diana.
- One long message can review many professors and courses. Extract ALL of them, one review each.
NOT reviews: registration logistics, waitlists, capacity, "who is dropping X", requests for
materials, a question with no evaluative answer, jokes, ads. The question itself is never
a review; only answers are. Never set sentiment from what the question asked.

Context: a question gives the course for its answers. "кого брать на калк 2?" answered by
"Samat норм" is a positive review of Samat for MATH 162. "A, B or C for WCS 200?" answered by
"B вышка, C дно" gives a positive review of B and a negative review of C, both WCS 200.

Course code: "PREFIX NNN" in uppercase, e.g. "MATH 162". Slang map:
{NICKNAMES}
Use only a course that is written or clearly implied by the thread. "каз 3хх" means "KAZ 3XX".
A wish or joke ("Ардак бы хорошо вел вкс") does not make a course. If unknown, use null
(JSON null, not the string "null").

Professor: copy the name EXACTLY as written in the chat, same script and spelling
("Бахтияр" stays "Бахтияр", "Майкл Аристидоу" stays "Майкл Аристидоу"). If the thread
writes a fuller name for the same person elsewhere, use the fuller form. Never translate,
transliterate, or invent a surname. A course-only review has professor null.

Merge messages about the same (professor, course) within a thread into one review with all
their message ids, but only include ids of messages that actually express the opinion.
message_ids must point at the ANSWERS that contain the opinion, never at the question.

summary: one short, faithful sentence, always in English. Only state what the messages say.
sentiment "mixed" when the text has clear pros and cons; do not round mixed to negative.
sentiment: "positive", "negative" or "mixed".
tags: 0 to 4 from this list, only when the text clearly supports them: {", ".join(TAGS)}.
No tag is better than a wrong tag.

Reply with JSON only:
{{"threads": [{{"root_id": 123, "reviews": [{{"professor": "Samat", "course": "MATH 162",
"message_ids": [456], "sentiment": "positive", "summary": "...", "tags": ["fair grading"]}}]}}]}}
Threads with no reviews get "reviews": []."""

COURSE_FMT = re.compile(r"^[A-Z]{2,5} (\d{3}|\dXX)$")


def clean_review(r, valid_ids):
    """Fix the usual small model mistakes and drop reviews that point at nothing."""
    def nullish(v):
        return v is None or str(v).strip().lower() in ("", "null", "none", "unknown", "n/a")

    prof = None if nullish(r.get("professor")) else str(r["professor"]).strip()
    course = None if nullish(r.get("course")) else str(r["course"]).strip().upper()
    if course:
        course = re.sub(r"^([A-Z]+)\s*-?\s*(\d)", r"\1 \2", course)
        course = re.sub(r"^WKS\b", "WCS", course)
        if not COURSE_FMT.match(course):
            course = course if re.match(r"^[A-Z]{2,5}$", course) else None
    ids = [int(i) for i in r.get("message_ids", []) if str(i).isdigit() and int(i) in valid_ids]
    if not ids or (not prof and not course):
        return None
    sentiment = r.get("sentiment") if r.get("sentiment") in ("positive", "negative", "mixed") else "mixed"
    tags = [t for t in r.get("tags", []) if t in TAGS][:4]
    return {"professor": prof, "course": course, "message_ids": ids, "sentiment": sentiment,
            "summary": str(r.get("summary", "")).strip(), "tags": tags}


def format_thread(t, max_chars=6000):
    lines = [f"### THREAD root_id={t['root_id']} date={(t['date'] or '')[:10]}"]
    used = 0
    for m in t["messages"]:
        text = m["text"].replace("\n", " / ")
        if used + len(text) > max_chars:
            lines.append("  (thread truncated)")
            break
        used += len(text)
        lines.append(f"{'  ' * m['depth']}[{m['id']}] {text}")
    return "\n".join(lines)


def make_batches(threads, max_chars):
    batch, size = [], 0
    for t in threads:
        s = sum(len(m["text"]) for m in t["messages"])
        if batch and size + s > max_chars:
            yield batch
            batch, size = [], 0
        batch.append(t)
        size += s
    if batch:
        yield batch


def parse_json(text):
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0) if m else text)


def complete(client, provider, model, prompt):
    if provider == "openai":
        resp = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": SYSTEM},
                      {"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content
    resp = client.messages.create(
        model=model,
        max_tokens=8000,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def fix_question_ids(review, thread):
    """Point a review at the answers when the model cited the question instead."""
    root = thread["messages"][0]
    if root["id"] not in review["message_ids"] or "?" not in root["text"]:
        return review
    replies = [m["id"] for m in thread["messages"] if m["depth"] == 1]
    rest = [i for i in review["message_ids"] if i != root["id"]]
    if rest:
        review["message_ids"] = rest
    elif replies:
        review["message_ids"] = replies
    return review


def worth_recheck(thread):
    """Threads with replies and review words that came back empty get a second, solo look."""
    if len(thread["messages"]) < 2:
        return False
    answers = " ".join(m["text"] for m in thread["messages"][1:])
    return bool(re.search(r"норм|лучш|дно|вышка|изи|easy|best|щедр|душ|керв|curve|не бер|бери|"
                          r"хорош|плох|жестк|строг|добр|интересн|скучн|grade|оценива", answers, re.I))


def call(client, provider, model, batch, retries=4):
    prompt = "\n\n".join(format_thread(t) for t in batch)
    for attempt in range(retries):
        try:
            data = parse_json(complete(client, provider, model, prompt))
            got = {int(x["root_id"]): x.get("reviews", []) for x in data["threads"]}
            out = []
            for t in batch:
                valid = {m["id"] for m in t["messages"]}
                reviews = [c for c in (clean_review(r, valid) for r in got.get(t["root_id"], [])) if c]
                reviews = [fix_question_ids(r, t) for r in reviews]
                out.append((t, reviews))
            # The model sometimes skips threads in a batch. Retry those one by one.
            if len(batch) > 1:
                for i, (t, reviews) in enumerate(out):
                    if not reviews and worth_recheck(t):
                        solo = call(client, provider, model, [t], retries)
                        if solo:
                            out[i] = solo[0]
            return out
        except Exception as e:
            if attempt == retries - 1:
                print(f"  batch failed ({e}); it will be retried on the next run", file=sys.stderr)
                return None
            time.sleep(2 ** attempt * 3)


def write_csv(tagged_path, csv_path):
    with open(tagged_path, encoding="utf-8") as f, open(csv_path, "w", newline="", encoding="utf-8-sig") as out:
        w = csv.writer(out)
        w.writerow(["keep", "root_id", "date", "professor", "course", "sentiment", "tags",
                    "summary", "message_ids", "original_text"])
        for line in f:
            t = json.loads(line)
            texts = {m["id"]: m["text"] for m in t["messages"]}
            for r in t["reviews"]:
                ids = [i for i in r.get("message_ids", []) if i in texts]
                original = " || ".join(texts[i] for i in ids)
                w.writerow(["yes", t["root_id"], (t["date"] or "")[:10], r.get("professor") or "",
                            r.get("course") or "", r.get("sentiment", ""), ", ".join(r.get("tags", [])),
                            r.get("summary", ""), " ".join(map(str, ids)), original])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("threads")
    ap.add_argument("-o", "--out", default="tagged.jsonl")
    ap.add_argument("--csv", default="reviews.csv")
    ap.add_argument("--limit", type=int, help="Only process this many threads (for testing)")
    ap.add_argument("--batch-chars", type=int, default=3000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--provider", choices=["anthropic", "openai"], default="anthropic")
    ap.add_argument("--model", help="Model name; defaults depend on provider")
    a = ap.parse_args()

    threads = [json.loads(l) for l in open(a.threads, encoding="utf-8")]
    done = set()
    if os.path.exists(a.out):
        done = {json.loads(l)["root_id"] for l in open(a.out, encoding="utf-8")}
    todo = [t for t in threads if t["root_id"] not in done]
    if a.limit:
        todo = todo[: a.limit]
    batches = list(make_batches(todo, a.batch_chars))
    print(f"{len(done)} threads already tagged, {len(todo)} to go in {len(batches)} requests")

    if a.dry_run:
        print("\n--- SYSTEM ---\n" + SYSTEM + "\n\n--- USER ---\n" +
              "\n\n".join(format_thread(t) for t in batches[0]))
        return

    model = a.model or DEFAULT_MODELS[a.provider]
    if a.provider == "openai":
        from openai import OpenAI
        client = OpenAI()
    else:
        import anthropic
        client = anthropic.Anthropic()
    print(f"Using {a.provider} / {model}")
    finished = 0
    with open(a.out, "a", encoding="utf-8") as out, ThreadPoolExecutor(a.workers) as pool:
        futures = [pool.submit(call, client, a.provider, model, b) for b in batches]
        for fut in as_completed(futures):
            res = fut.result()
            finished += 1
            if res is None:
                continue
            for t, reviews in res:
                t = dict(t, reviews=reviews)
                out.write(json.dumps(t, ensure_ascii=False) + "\n")
            out.flush()
            if finished % 20 == 0:
                print(f"  {finished}/{len(batches)} requests done")

    write_csv(a.out, a.csv)
    print(f"Done. Tagged threads in {a.out}, review rows in {a.csv}")


if __name__ == "__main__":
    main()

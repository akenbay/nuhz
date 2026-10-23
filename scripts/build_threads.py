#!/usr/bin/env python3
"""
Group extracted Telegram messages into conversation threads and drop threads
that are obviously not about professors or courses.

In the Prof. Evaluation topic, a review is rarely one standalone message.
It is usually a question ("кого брать на калк 2?") with answers underneath,
so the thread is the unit we tag later.

Usage:
  python build_threads.py reviews.jsonl -o threads.jsonl --topic-id 398886
"""
import argparse
import json
import re
from collections import defaultdict

COURSE_RE = re.compile(
    r"\b([A-Za-z]{2,5}|вкс|каз|экон|хст|биол|физ|мат|матх|фил|хим|пол|кск|цски|кс|ксс|линг|соц|ант|плс|бус|влл)\s?-?(\d{3}|\dхх|\dxx)\b",
    re.I,
)
SIGNAL_RE = re.compile(
    r"проф|препод|prof|instructor|lecturer|сложн|легк|лёгк|easy|hard|tough|"
    r"оценива|grade|gpa|мидк|midterm|финал|final|экзам|exam|квиз|quiz|"
    r"лекци|lecture|рекоменд|recommend|советую|не берите|берите|стоит|worth|"
    r"хорош|плох|строг|strict|чил|chill|нудн|boring|интересн|interesting|"
    r"объясня|explain|attendance|посещаем|participation|essay|эссе|curve|курв|"
    r"норм|этик|ethic|калк|calc|линал|linal|генкем|кто знает|who knows|как он|как она|кого брать",
    re.I,
)
NOISE_RE = re.compile(
    r"продам|продаю|куплю|ищу контроллер|в личные сообщения|отдам|sell|selling|"
    r"вакансия|vacancy|набираем|скидк",
    re.I,
)


def has_signal(text):
    return bool(COURSE_RE.search(text) or SIGNAL_RE.search(text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reviews")
    ap.add_argument("-o", "--out", default="threads.jsonl")
    ap.add_argument("--topic-id", type=int, default=398886)
    ap.add_argument("--min-single-chars", type=int, default=60,
                    help="A thread with one message is kept only if it is at least this long")
    a = ap.parse_args()

    msgs = [json.loads(l) for l in open(a.reviews, encoding="utf-8")]
    by_id = {m["id"]: m for m in msgs}
    children = defaultdict(list)
    roots = []
    for m in msgs:
        p = m["reply_to"]
        # Parent is the topic itself, or was dropped earlier (too short, deleted): start a thread here.
        if p == a.topic_id or p not in by_id:
            roots.append(m["id"])
        else:
            children[p].append(m["id"])

    def walk(mid, depth=0, out=None):
        out = [] if out is None else out
        m = by_id[mid]
        out.append({"id": mid, "depth": depth, "date": m["date"], "author": m["author"],
                    "text": m["text"]})
        for c in sorted(children.get(mid, [])):
            walk(c, depth + 1, out)
        return out

    kept = dropped_noise = dropped_weak = 0
    with open(a.out, "w", encoding="utf-8") as f:
        for r in sorted(roots):
            thread = walk(r)
            full = "\n".join(t["text"] for t in thread)
            if NOISE_RE.search(thread[0]["text"]) and len(thread) == 1:
                dropped_noise += 1
                continue
            if not has_signal(full):
                dropped_weak += 1
                continue
            if len(thread) == 1 and len(full) < a.min_single_chars:
                dropped_weak += 1
                continue
            f.write(json.dumps({"root_id": r, "date": thread[0]["date"], "messages": thread},
                               ensure_ascii=False) + "\n")
            kept += 1

    print(f"Threads total: {len(roots)}")
    print(f"Kept: {kept}   dropped (ads/noise): {dropped_noise}   dropped (no review signal): {dropped_weak}")


if __name__ == "__main__":
    main()

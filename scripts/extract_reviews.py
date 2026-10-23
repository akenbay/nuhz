#!/usr/bin/env python3
"""
Extract only the messages that belong to one forum topic (or one reply thread)
from a Telegram Desktop JSON export, streaming the file so a 300 MB export
does not need to fit in memory.

How membership is decided:
  In a forum supergroup, a message posted in a topic has reply_to_message_id
  pointing at the topic's root message (the "topic_created" service message).
  A reply inside the topic points at another message in that topic.
  So a message belongs to the topic if following its reply chain upward
  eventually reaches the topic root. The same logic works for a comment
  thread under a single post: pass that post's id as --topic-id.

Usage:
  pip install ijson
  python extract_reviews.py result.json --list-topics
  python extract_reviews.py result.json --topic-title "Reviews" -o reviews.jsonl
  python extract_reviews.py result.json --topic-id 12345 -o reviews.jsonl

If you exported "all chats" instead of a single chat, the messages live at a
different path; pass e.g. --prefix "chats.list.item.messages.item".
"""
import argparse
import hashlib
import json
import sys
from collections import Counter

try:
    import ijson
except ImportError:
    sys.exit("Missing dependency: pip install ijson")


def iter_messages(path, prefix):
    with open(path, "rb") as f:
        yield from ijson.items(f, prefix, use_float=True)


def flatten_text(t):
    """Telegram stores text either as a string or as a list of strings/entity dicts."""
    if isinstance(t, str):
        return t
    if isinstance(t, list):
        return "".join(p if isinstance(p, str) else p.get("text", "") for p in t)
    return ""


def list_topics(path, prefix):
    topics = {}
    direct_replies = Counter()
    total = 0
    for m in iter_messages(path, prefix):
        total += 1
        if m.get("type") == "service" and m.get("action") == "topic_created":
            topics[m["id"]] = m.get("title", "")
        r = m.get("reply_to_message_id")
        if r is not None:
            direct_replies[r] += 1

    print(f"Scanned {total} messages.\n")
    if topics:
        print("Forum topics found (id, direct replies, title):")
        for tid, title in sorted(topics.items(), key=lambda kv: -direct_replies[kv[0]]):
            print(f"  {tid:>10}  {direct_replies[tid]:>7}  {title}")
    else:
        print("No forum topics found. Most replied-to messages (possible thread roots):")
        for mid, n in direct_replies.most_common(20):
            print(f"  {mid:>10}  {n:>7} replies")


def resolve_topic_id(path, prefix, title):
    title_l = title.lower()
    matches = []
    for m in iter_messages(path, prefix):
        if m.get("type") == "service" and m.get("action") == "topic_created":
            if title_l in (m.get("title") or "").lower():
                matches.append((m["id"], m.get("title")))
    if not matches:
        sys.exit(f"No topic with a title containing '{title}'. Run --list-topics.")
    if len(matches) > 1:
        print("Several topics match, use --topic-id with one of these:")
        for tid, t in matches:
            print(f"  {tid}  {t}")
        sys.exit(1)
    print(f"Using topic {matches[0][0]}: {matches[0][1]}")
    return matches[0][0]


def extract(path, prefix, topic_id, out_path, keep_authors, salt, min_chars):
    # Pass 1: build a compact id -> parent map (just ints, cheap even for millions of messages).
    parent = {}
    for m in iter_messages(path, prefix):
        parent[m["id"]] = m.get("reply_to_message_id")

    memo = {topic_id: True}

    def belongs(mid):
        chain = []
        cur = mid
        while cur is not None and cur not in memo:
            chain.append(cur)
            cur = parent.get(cur)
        result = memo.get(cur, False) if cur is not None else False
        for c in chain:
            memo[c] = result
        return result

    def anon(from_id):
        if not from_id:
            return None
        return hashlib.sha256((salt + str(from_id)).encode()).hexdigest()[:12]

    # Pass 2: write the matching messages.
    kept = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for m in iter_messages(path, prefix):
            if m.get("type") != "message" or m["id"] == topic_id:
                continue
            if not belongs(m["id"]):
                continue
            text = flatten_text(m.get("text")).strip()
            if len(text) < min_chars:
                continue
            rec = {
                "id": m["id"],
                "date": m.get("date"),
                "reply_to": m.get("reply_to_message_id"),
                "author": anon(m.get("from_id")),
                "text": text,
                "edited": m.get("edited"),
                "has_media": bool(m.get("photo") or m.get("file") or m.get("media_type")),
            }
            if keep_authors:
                rec["author_name"] = m.get("from")
                rec["author_id"] = m.get("from_id")
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            kept += 1

    print(f"Wrote {kept} messages to {out_path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("export", help="Path to Telegram result.json")
    ap.add_argument("--prefix", default="messages.item", help="ijson path to messages")
    ap.add_argument("--list-topics", action="store_true", help="List forum topics and exit")
    ap.add_argument("--topic-id", type=int, help="Root message id of the topic or thread")
    ap.add_argument("--topic-title", help="Find the topic by (part of) its title")
    ap.add_argument("-o", "--out", default="reviews.jsonl")
    ap.add_argument("--keep-authors", action="store_true",
                    help="Keep real names/ids (default: replaced with a salted hash)")
    ap.add_argument("--salt", default="change-me", help="Salt for author hashing")
    ap.add_argument("--min-chars", type=int, default=15,
                    help="Skip very short messages like 'thanks' or '+'")
    a = ap.parse_args()

    if a.list_topics:
        list_topics(a.export, a.prefix)
        return
    topic_id = a.topic_id
    if topic_id is None:
        if not a.topic_title:
            ap.error("Pass --topic-id or --topic-title (or --list-topics first)")
        topic_id = resolve_topic_id(a.export, a.prefix, a.topic_title)
    extract(a.export, a.prefix, topic_id, a.out, a.keep_authors, a.salt, a.min_chars)


if __name__ == "__main__":
    main()

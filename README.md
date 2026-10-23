# nuhz

Search NU professor and course reviews from the Prof. Evaluation topic of the NU student Telegram chat.

Static Next.js site. All pages are generated at build time from `data/site_data.json`, so there is no backend.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/
```

## Deploy

Import the repo on Vercel. No settings needed: it detects Next.js and serves the static export.

## Updating the data

The pipeline lives in `scripts/`. Run it on a fresh Telegram export (Telegram Desktop, JSON format).
Never commit the raw export or the intermediate files; `.gitignore` already excludes them.

```bash
pip install ijson openai   # or anthropic

# 1. Pull only the Prof. Evaluation topic out of the export (authors are anonymized)
python scripts/extract_reviews.py result.json --topic-id 398886 -o reviews.jsonl

# 2. Group messages into question and answer threads, drop obvious noise
python scripts/build_threads.py reviews.jsonl -o threads.jsonl

# 3. Tag each thread with professor, course, sentiment, summary (resumable)
export OPENAI_API_KEY=...
python scripts/tag_threads.py threads.jsonl --provider openai

# 4. Merge name variants and write the site data
python scripts/merge_and_export.py tagged.jsonl -o data/site_data.json --aliases data/names.csv
```

### Fixing names

`data/names.csv` maps every raw spelling to a professor. Edit the `canonical` column to merge two
entries (give them the same canonical name), split one, or write `DROP` for words that aren't names.
Rerun step 4 with `--aliases data/names.csv`. Manual edits always win over automatic merging.

## Structure

```
app/page.tsx              home and search
app/p/[id]/page.tsx       professor page
app/c/[slug]/page.tsx     course page
app/search-index.json     search index, generated at build time
components/               search box, review list, sentiment bar
lib/data.ts               data access
lib/search.ts             Latin and Cyrillic name matching, course code and slang parsing
```

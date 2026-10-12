# Agent guidelines

- Never mention AI tools or assistants anywhere that is pushed: no assistant co-author or
  session trailers, no "generated with" lines, in commits, PRs, comments, code or docs.
- Merge pull requests with squash and merge.
- Before a commit: `npm run check` and `npm run build -- tests/fixtures/raw.json`.
- `docs/format.md` is the contract with clients: change it in the same change as the
  code that writes the files.
- One folder under `v1/` per dataset. A new dataset also gets an entry in `src/catalog.ts`
  and its sources in `SOURCES`.
- Respect every licence: values come from Wikidata (CC0) only. Wikivoyage and Wikipedia
  are linked, never copied. A new source needs its licence in `SOURCES` and the README.
- Never correct data here: errors are fixed on Wikidata, at each record's `source`.

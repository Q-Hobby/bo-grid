# Using bo-grid with an AI coding assistant

bo-grid ships machine-readable references so an AI agent generates correct
code against it — real prop names, real subpath boundaries, no invented API —
instead of guessing from a half-remembered training example.

## 1. Docs an agent can read — works with any agent that fetches URLs

Published with the docs site, all generated from the docs and the types on
every build, so they match the released version:

- **[llms.txt](https://bonguynvan.github.io/bo-grid/llms.txt)** — the facts
  an agent must get right first, then every docs page as a Markdown link.
- **Every docs page as Markdown** — add `.md` to a page's path
  (`/docs/realtime/` → [`/docs/realtime.md`](https://bonguynvan.github.io/bo-grid/docs/realtime.md)),
  or use the page's Copy page button. Example code is inlined.
- **[api.json](https://bonguynvan.github.io/bo-grid/api.json)** — every
  `<Grid>` prop, column option and API method with its type, default and
  docs, generated from the TypeScript sources.
- **[llms-full.txt](https://bonguynvan.github.io/bo-grid/llms-full.txt)** —
  every page and the full reference in one file, to paste into a chat.

The installed package carries the same docs for its version, so an agent can
read them with no network:

- **`node_modules/bo-grid/dist/docs/`**: `README.md` (the index), one
  Markdown file per docs page, `reference.md` and `api.json`.
- **The `.d.ts` files** in `node_modules/bo-grid/dist`: the same TSDoc, with
  a default and an example beside each prop.

## 2. Project rule files — install once, every session gets it right

Two ready-to-copy files, same guidance in each tool's format:

| Tool | File | Where it goes in *your* project |
| --- | --- | --- |
| Cursor / Windsurf | [`cursor-rules.mdc`](./cursor-rules.mdc) | `.cursor/rules/bo-grid.mdc` |
| Claude Code / any agent reading `CLAUDE.md`/`AGENTS.md` | [`claude-md-snippet.md`](./claude-md-snippet.md) | append into your `CLAUDE.md` (or `AGENTS.md`) |

Both are short by design (they're injected into every relevant prompt) and
point to the docs in the package and `api.json` for anything beyond the essentials, rather
than duplicating the whole API surface into a rule file that goes stale.

## 3. Keeping these current

These files describe the API as of the version in `package.json` at the time
they were last updated. If you hit a mismatch, `CHANGELOG.md` is the source
of truth — open an issue if `llms-full.txt` is out of date with a release.

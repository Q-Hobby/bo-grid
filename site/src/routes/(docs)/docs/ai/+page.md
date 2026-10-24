---
title: AI coding agents
description: TODO
---

Real props, real subpath boundaries, nothing invented:

- **[llms.txt](https://bonguynvan.github.io/bo-grid/llms.txt)** /
  **[llms-full.txt](https://bonguynvan.github.io/bo-grid/llms-full.txt)** —
  machine-readable references. Paste `llms-full.txt` into a chat, or point an
  agent that fetches URLs (Cursor, Windsurf, Claude Code, browsing ChatGPT) at
  it before asking for bo-grid code — it has every `ColumnDef`/`<Grid>` prop,
  every subpath's exports, and a "things an AI commonly gets wrong" list (the
  #1 one: writing `flashSeq++` bookkeeping instead of `flash: 'auto'`).
- **[Cursor/Windsurf rule](https://github.com/bonguynvan/bo-grid/blob/main/docs/ai/cursor-rules.mdc)** and
  **[CLAUDE.md snippet](https://github.com/bonguynvan/bo-grid/blob/main/docs/ai/claude-md-snippet.md)** — copy one into your
  own project (`.cursor/rules/bo-grid.mdc` or your `CLAUDE.md`) so every
  session gets it right without you repeating yourself. See
  [docs/ai](https://github.com/bonguynvan/bo-grid/blob/main/docs/ai) for the full picture.

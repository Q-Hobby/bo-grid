# Evals

How well does a coding agent use bo-grid? These evals measure it instead of
guessing. Each task asks an agent for one realistic change in a small Svelte 5
app with bo-grid installed. Graders then score the result, and the run records
what the agent spent.

Each task runs under two conditions:

- **`bare`**: the app as `npm i bo-grid` leaves it.
- **`init`**: the same app after `npx bo-grid init` (the bo-grid section in
  `AGENTS.md` and the bo-grid skill), plus the `@AGENTS.md` line in
  `CLAUDE.md` that init asks Claude Code users to add.

The gap between them shows whether `init` helps. A failure that repeats is a
lead: a doc to fix, an API that misleads, or an error message that doesn't
say enough.

## Run

```sh
node evals/run.mjs                      # every task, both conditions, once
node evals/run.mjs --tasks live-board --conditions init --repeat 3
node evals/run.mjs --model sonnet       # pin the agent's model
node evals/run.mjs --jobs 4             # run four at a time
node evals/run.mjs --solutions          # grade evals/solutions/: all pass
node evals/run.mjs --untouched          # grade the starting apps: all fail
```

It needs Node 22 or later, pnpm, and Claude Code (`claude`), which runs
headless (`claude -p`) on your account. **Each run costs what the agent
spends**, and the summary prints the total. Without `--model` the agent uses
your default model, so pin it to compare results between runs or machines.
`--no-build` reuses the last `pnpm package`. bo-grid is packed from the
working tree, so uncommitted changes are what gets tested.

## Safety

Read this before a run with the agent (`--solutions` and `--untouched` start
no agent):

- **The agent is not sandboxed.** It runs with your user's rights, and it may
  use the shell and the network, as it would in a real project. It works in
  a temporary copy of the app, but nothing stops a command from reaching
  outside it. Run the evals on a machine or account where that is acceptable,
  or in a container.
- **Secrets in the environment are removed** before the agent starts:
  variables whose names look like tokens, keys or passwords. `ANTHROPIC_*` and
  `CLAUDE_*` stay, because Claude Code may need them to sign in. Files such as
  `~/.npmrc` or `~/.ssh` remain readable.
- **It loads only the run's own settings** (`--setting-sources project,local`)
  and no MCP servers, so your settings, hooks, permissions and MCP servers
  stay out. Each run is its own git repository, so nothing above it is read
  as part of the project.
- **The runs share one `node_modules`** through a link (a junction on
  Windows). The agent may not install, remove or edit packages, and after each
  run the evals check that the install is unchanged: a run that changed it is
  marked errored, and the install is rebuilt. To delete old runs, delete the
  `runs/` folder with a tool that does not follow links (`rm -rf` or Node's
  `fs.rm`), never with Windows PowerShell 5.1's `Remove-Item -Recurse`, which
  can delete the shared install through the link.

## How a run works

The runner works in the OS temp folder (`bo-grid-evals/`), outside this
repository, so the repository's own settings don't reach the agent. There it:

1. builds and packs bo-grid, and installs it in a base copy of the app (its
   other dependencies are installed once);
2. gives each run a fresh copy of the app with the task's files and its own
   git repository, and links in the base `node_modules`;
3. for `init`, runs `npx bo-grid init` and adds `@AGENTS.md` to `CLAUDE.md`;
4. runs the agent with the task's prompt. It may edit and read files, use the
   shell (to type-check, say), and read the bo-grid docs online;
5. puts back every starting file except `src/App.svelte` (config, data, the
   feed), so the graders read what the task gave and not what the agent may
   have changed;
6. grades the result.

Each result is appended to `results/<time>.jsonl` as its run finishes, so a
stopped run loses nothing. `results/<time>.json` has them all at the end. A run's
folder keeps the agent's event stream (`.agent-trace.jsonl`: every tool call,
then what the run cost), and its git history shows the change
(`git diff HEAD`). The summary also counts what the agents read: the docs in
the package, the skill, `AGENTS.md`, the type definitions, the docs online. The results hold local paths and error
text: don't paste them anywhere public. Nothing cleans `runs/` and `results/`
up; delete them when you're done (see Safety).

A run where the agent itself fails (Claude Code missing, not signed in,
rate-limited, timed out after 15 minutes) is marked **errored**, apart from
the passes and fails. If the first run errors, the evals stop and say why.

## Grading

A run **passes** when:

- the type check passes (`svelte-check`, errors only);
- the task's **checks** match the source (`task.json`: a regular expression
  that must match, or must not);
- the task's behaviour tests pass (`check.test.ts`, with the helpers in
  `check/setup.ts` and the Vitest config in `check/vitest.config.ts`). These
  are copied into the run only after the agent has finished, so they are not
  in its folder while it works.

**Idioms** are reported apart and don't decide a pass. They check that the
code is written the way the docs recommend: `flash: 'auto'` rather than
hand-written flash state, `patchRows` for a fast feed, `groupAgg` for totals.

## Add a task

Create `tasks/<id>/` with:

- `task.json`: `title`, `prompt`, `checks` and `idioms`;
- `files/`: files that overlay the app in `template/` (data, a starting
  `App.svelte`);
- `check.test.ts`: behaviour tests that mount `App.svelte`.

Then add a working answer in `solutions/<id>/` and run `--solutions` and
`--untouched`. The solution must pass and the untouched app must fail;
otherwise the graders are wrong.

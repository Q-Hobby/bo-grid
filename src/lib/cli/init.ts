// `npx bo-grid init`: writes the bo-grid section into a project's AGENTS.md
// and installs the bo-grid skill, so a coding agent starts from the docs of
// the installed version. The logic is here, on paths relative to the project;
// bin.js gives it the file system. Nothing in the library imports this file.

/** The project's files, as bin.js (or a test) provides them. Paths are relative
    to the project, with `/` separators. */
export interface ProjectFiles {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  /** The file's text, or undefined when there is no such file. */
  read(path: string): string | undefined;
  /** Writes the file, creating its folders. */
  write(path: string, text: string): void;
}

/** What init writes: the AGENTS.md section and the skill. */
export interface InitAssets {
  section: string;
  skill: string;
}

export interface InitOptions {
  /** The project folder, relative to where the command runs. */
  cwd: string;
  /** The files that get the section. */
  files: string[];
  skill: boolean;
  skillsDir: string;
  dryRun: boolean;
  json: boolean;
}

/** `conflict`: init left the file alone on purpose; `failed`: it could not
    read or write it. Either way `reason` says why. */
export type FileStatus = 'created' | 'updated' | 'unchanged' | 'conflict' | 'failed';

export interface FileResult {
  path: string;
  status: FileStatus;
  reason?: string;
}

export interface InitResult {
  dryRun: boolean;
  files: FileResult[];
  notes: string[];
}

export interface CliEnv {
  assets: InitAssets;
  project(cwd: string): ProjectFiles;
  out(text: string): void;
  err(text: string): void;
}

export const START = '<!-- bo-grid:start: npx bo-grid init replaces this section -->';
export const END = '<!-- bo-grid:end -->';
const START_LINE = /^<!-- bo-grid:start\b[^>]*-->\s*$/;
const END_LINE = /^<!-- bo-grid:end -->\s*$/;
/** A bo-grid section pasted by hand from the docs: its heading, or the path it
    tells an agent to read. */
const PASTED = /^#{1,6}\s+bo-grid \((?:Svelte 5 )?data grid\)\s*$|node_modules\/bo-grid\/dist\/docs\//;

const SKILL_FILE = 'bo-grid/SKILL.md';
const DEFAULTS: InitOptions = { cwd: '.', files: ['AGENTS.md'], skill: true, skillsDir: '.claude/skills', dryRun: false, json: false };

export const USAGE = `Usage: npx bo-grid init [options]

Writes the bo-grid section into AGENTS.md, between markers, and installs the
bo-grid skill in .claude/skills/bo-grid/SKILL.md. Both point a coding agent at
the docs of the installed version in node_modules/bo-grid/dist/docs/. Running
it again updates them: it replaces its own section and leaves the rest of
AGENTS.md as it is, and it replaces the skill file with the current one.

Options:
  --file <path>        Write the section into this file instead of AGENTS.md
                       (for example CLAUDE.md). Repeat for more than one.
  --no-skill           Do not install the skill.
  --skills-dir <dir>   Install the skill under this folder (default .claude/skills).
  --cwd <dir>          The project folder (default: the current folder).
  --dry-run            Report what would change, write nothing.
  --json               Print the result as JSON.
  -h, --help           Show this help.

Exit codes: 0 done, 1 a file was left alone or could not be written, 2 bad usage.
`;

/** The marker lines outside code fences, as [start, end] offsets of each line
    (without its line break). */
function markers(text: string): { starts: [number, number][]; ends: [number, number][] } {
  const starts: [number, number][] = [];
  const ends: [number, number][] = [];
  let fence: string | null = null;
  let at = 0;
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const span: [number, number] = [at, at + line.length];
    at += raw.length + 1;
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1][0];
    if (f) fence = fence === null ? f : fence === f ? null : fence;
    else if (fence === null && START_LINE.test(line)) starts.push(span);
    else if (fence === null && END_LINE.test(line)) ends.push(span);
  }
  return { starts, ends };
}

/** `text` with the bo-grid section written in: replaced between its markers,
    or added at the end. Anything it cannot place safely is a conflict, and the
    text comes back as it was: markers that don't pair up, or a bo-grid section
    pasted without markers (so the file never gets two). Keeps the file's line
    endings. */
export function withSection(text: string | undefined, section: string): { text: string; status: FileStatus; reason?: string } {
  const eol = text?.includes('\r\n') ? '\r\n' : '\n';
  const block = [START, section.replace(/\r\n/g, '\n').trim(), END].join('\n').replace(/\n/g, eol);
  const result = (status: FileStatus, next = text ?? '', reason?: string) => ({ text: next, status, ...(reason ? { reason } : {}) });
  if (text === undefined) return result('created', block + eol);

  const { starts, ends } = markers(text);
  if (starts.length === 1 && ends.length === 1 && starts[0][0] < ends[0][0]) {
    const next = text.slice(0, starts[0][0]) + block + text.slice(ends[0][1]);
    return result(next === text ? 'unchanged' : 'updated', next);
  }
  if (starts.length || ends.length)
    return result('conflict', text, `its bo-grid markers don't pair up (${starts.length} start, ${ends.length} end); keep one start and one end marker, or delete them, and run init again`);
  const pasted = text.split('\n').findIndex((line) => PASTED.test(line.replace(/\r$/, '')));
  if (pasted >= 0)
    return result('conflict', text, `it has a bo-grid section that init did not write (line ${pasted + 1}); delete that section and run init again to get the current one, or keep yours`);
  const gap = text === '' || /\r?\n\r?\n$/.test(text) ? '' : /\r?\n$/.test(text) ? eol : eol + eol;
  return result('updated', text + gap + block + eol);
}

export function parseArgs(argv: string[]): { command: 'init' | 'help'; options: InitOptions } | { error: string } {
  const [command, ...rest] = argv;
  if (command === 'help' || command === '-h' || command === '--help') return { command: 'help', options: DEFAULTS };
  if (command !== 'init') return { error: command === undefined ? 'Missing the command.' : `Unknown command "${command}".` };
  const options: InitOptions = { ...DEFAULTS, files: [] };
  const seen = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const [flag, inline] = rest[i].split(/=(.*)/s, 2);
    if (flag === '-h' || flag === '--help') return { command: 'help', options };
    if (flag === '--dry-run' || flag === '--json' || flag === '--no-skill') {
      if (inline !== undefined) return { error: `${flag} takes no value.` };
      if (flag === '--dry-run') options.dryRun = true;
      else if (flag === '--json') options.json = true;
      else options.skill = false;
    } else if (flag === '--file' || flag === '--cwd' || flag === '--skills-dir') {
      const value = inline ?? (rest[i + 1]?.startsWith('-') ? undefined : rest[++i]);
      if (!value) return { error: `${flag} needs a value, such as ${flag === '--file' ? '--file CLAUDE.md' : `${flag} ./app`}.` };
      if (flag !== '--file' && seen.has(flag)) return { error: `${flag} is given twice.` };
      seen.add(flag);
      if (flag === '--file') options.files.push(value);
      else if (flag === '--cwd') options.cwd = value;
      else options.skillsDir = value;
    } else return { error: `Unknown option "${rest[i]}".` };
  }
  if (options.files.length === 0) options.files = DEFAULTS.files;
  return { command: 'init', options };
}

/** `\` to `/`, without trailing slashes (but `/` stays `/`). */
const toPosix = (path: string): string => path.replace(/\\/g, '/').replace(/(.)\/+$/, '$1');
const under = (dir: string, file: string): string => (dir.endsWith('/') ? dir + file : `${dir}/${file}`);
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The file's text, or why init can't use it. */
function load(project: ProjectFiles, path: string): { text: string | undefined } | { reason: string } {
  if (project.isDirectory(path)) return { reason: 'it is a folder' };
  try {
    const text = project.read(path);
    if (text?.includes('�') || text?.includes('\0')) return { reason: 'it is not UTF-8 text' };
    return { text };
  } catch (e) {
    return { reason: message(e) };
  }
}

/** Plans every file first, then writes the ones that change (unless `dryRun`),
    and reports each one. A file it cannot write does not stop the others. */
export function init(options: InitOptions, project: ProjectFiles, assets: InitAssets): InitResult {
  const plan: (FileResult & { text?: string })[] = [];
  const files = [...new Set(options.files.map(toPosix))];
  for (const path of files) {
    const loaded = load(project, path);
    plan.push('reason' in loaded ? { path, status: 'conflict', reason: loaded.reason } : { path, ...withSection(loaded.text, assets.section) });
  }
  if (options.skill) {
    const path = under(toPosix(options.skillsDir), SKILL_FILE);
    const loaded = load(project, path);
    if ('reason' in loaded) plan.push({ path, status: 'conflict', reason: loaded.reason });
    else {
      const current = loaded.text;
      const text = current?.includes('\r\n') ? assets.skill.replace(/\r?\n/g, '\r\n') : assets.skill;
      plan.push({ path, text, status: current === undefined ? 'created' : current === text ? 'unchanged' : 'updated' });
    }
  }

  const results: FileResult[] = plan.map(({ path, status, reason, text }) => {
    if (options.dryRun || (status !== 'created' && status !== 'updated') || text === undefined) return { path, status, ...(reason ? { reason } : {}) };
    try {
      project.write(path, text);
      return { path, status };
    } catch (e) {
      return { path, status: 'failed', reason: message(e) };
    }
  });

  const notes: string[] = [];
  if (!project.exists('node_modules/bo-grid'))
    notes.push('node_modules/bo-grid is not in this folder, and the section points there. Install bo-grid (npm i bo-grid), or run init where it is installed, with --cwd <folder>.');
  const claude = files.includes('CLAUDE.md') ? undefined : load(project, 'CLAUDE.md');
  if (claude && 'text' in claude && claude.text !== undefined && !/@AGENTS\.md\b/.test(claude.text))
    notes.push('CLAUDE.md does not import AGENTS.md. If your agent reads CLAUDE.md (Claude Code does), add the line @AGENTS.md to it, or run npx bo-grid init --file CLAUDE.md.');
  for (const { path, status, reason } of results)
    if (reason) notes.push(`${path} was ${status === 'failed' ? 'not written' : 'left alone'}: ${reason}.`);
  return { dryRun: options.dryRun, files: results, notes };
}

function report(result: InitResult): string {
  const width = Math.max(...result.files.map((f) => f.status.length));
  const lines = result.files.map((f) => `  ${f.status.padEnd(width)}  ${f.path}`);
  if (result.dryRun) lines.push('Dry run: nothing was written.');
  return [...lines, ...result.notes.map((n) => `Note: ${n}`)].join('\n') + '\n';
}

/** Runs the command and returns the exit code. */
export function main(argv: string[], env: CliEnv): number {
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    env.err(`${parsed.error} Run npx bo-grid init, or npx bo-grid --help for the options.\n\n${USAGE}`);
    return 2;
  }
  if (parsed.command === 'help') {
    env.out(USAGE);
    return 0;
  }
  const { options } = parsed;
  try {
    const project = env.project(options.cwd);
    if (!project.isDirectory('.')) {
      env.err(`--cwd ${options.cwd} is not a folder. Pass the folder of your app, such as --cwd ./apps/web.\n`);
      return 2;
    }
    const result = init(options, project, env.assets);
    env.out(options.json ? JSON.stringify(result, null, 2) + '\n' : report(result));
    return result.files.some((f) => f.status === 'conflict' || f.status === 'failed') ? 1 : 0;
  } catch (e) {
    if (options.json) env.out(JSON.stringify({ error: message(e) }) + '\n');
    else env.err(`bo-grid init could not finish: ${message(e)}\n`);
    return 1;
  }
}

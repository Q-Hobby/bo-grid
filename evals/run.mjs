// Runs the evals: a coding agent does each task in a fresh copy of a small
// Svelte 5 app with bo-grid installed, and graders score what it wrote.
//
//   node evals/run.mjs                      every task, with and without init
//   node evals/run.mjs --tasks live-board --conditions init --repeat 3
//   node evals/run.mjs --model sonnet       pin the agent's model
//   node evals/run.mjs --jobs 4             run four at a time
//   node evals/run.mjs --solutions          grade evals/solutions/ instead of
//                                           running the agent: every run passes
//   node evals/run.mjs --untouched          grade the starting app as it is:
//                                           every run fails (both test the graders)
//
// Conditions: `bare` is the app as `npm i bo-grid` leaves it; `init` runs
// `npx bo-grid init` first, and adds the CLAUDE.md line init asks Claude Code
// users for (`@AGENTS.md`). The agent is Claude Code, headless (`claude -p`),
// on your account: each run costs what the agent spends. See README.md, and
// its "Safety" section, before running it.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const EVALS = join(ROOT, 'evals');
const WORK = join(tmpdir(), 'bo-grid-evals');
const AGENT_TIMEOUT = 15 * 60_000;
const GRADE_TIMEOUT = 5 * 60_000;
/** What the agent may do without asking: what it would in a real project
    (edit and read files, use the shell) and read the bo-grid docs online. */
const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Skill', 'Bash', 'PowerShell', 'WebFetch(domain:bonguynvan.github.io)'];
/** Refused: changing the installed packages, which the runs share. */
const DISALLOWED_TOOLS = [
  ...['npm install', 'npm i', 'npm add', 'npm ci', 'npm update', 'npm uninstall', 'npm remove', 'npm rm', 'npm prune', 'npm link', 'npm dedupe', 'pnpm', 'yarn', 'bun', 'corepack'].flatMap((c) => [`Bash(${c} *)`, `PowerShell(${c} *)`]),
  'Edit(./node_modules/**)',
  'Write(./node_modules/**)',
];
/** Environment variables the agent does not get. It keeps ANTHROPIC_* and
    CLAUDE_*, which Claude Code may need to sign in. */
const SECRET_ENV = /TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|_KEY$|^AWS_|^AZURE_|^GOOGLE_|^NPM_CONFIG__/i;
/** Where each run's result is appended as it finishes (set once known). */
let jsonl = '';

const args = parseArgs(process.argv.slice(2));
const allTasks = readdirSync(join(EVALS, 'tasks'));
const unknown = (args.tasks ?? []).filter((t) => !allTasks.includes(t));
if (unknown.length) fail(`No task named ${unknown.join(', ')}. Tasks: ${allTasks.join(', ')}`);
const tasks = allTasks.filter((t) => !args.tasks || args.tasks.includes(t));
const mode = args.solutions ? 'solutions' : args.untouched ? 'untouched' : 'agent';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runs = join(WORK, 'runs', stamp);
mkdirSync(join(WORK, 'results'), { recursive: true });
jsonl = join(WORK, 'results', `${stamp}.jsonl`);

const base = prepareBase();
const results = [];
const jobs = tasks.flatMap((task) => {
  const spec = JSON.parse(readFileSync(join(EVALS, 'tasks', task, 'task.json'), 'utf8'));
  return args.conditions.flatMap((condition) => Array.from({ length: args.repeat }, (_, k) => ({ task, spec, condition, repeat: k + 1 })));
});
/** Why no more runs start: the first agent run errored, or a run changed the shared install. */
let stop = '';
let next = 0;
// `--jobs` runs work in parallel; each takes the next run until none are left.
await Promise.all(
  Array.from({ length: Math.min(args.jobs, jobs.length) }, async () => {
    while (!stop && next < jobs.length) await runJob(jobs[next++]);
  }),
);
if (stop) {
  if (base.fingerprint !== fingerprint(base.dir)) reinstallBase();
  fail(stop);
}

async function runJob({ task, spec, condition, repeat }) {
  const name = `${task} · ${condition} · ${repeat}/${args.repeat}`;
  const dir = join(runs, `${task}-${condition}-${repeat}`);
  log(`▶ ${name}`);
  setupRun(dir, task, condition);
  const agent = mode === 'solutions' ? applySolution(dir, task) : mode === 'untouched' ? {} : await runAgent(dir, spec.prompt);
  if (mode === 'agent' && agent.error && !results.some((r) => !r.errored)) {
    stop ||= `The agent did not run: ${agent.error}\nCheck that \`claude -p "hello"\` works in a terminal, then run the evals again.`;
  }
  if (fingerprint(base.dir) !== base.fingerprint) {
    agent.error = 'it changed the shared node_modules';
    if (args.jobs === 1) reinstallBase();
    else stop ||= `${name} changed the shared node_modules; the runs still going finished, and it has been reinstalled. Run again with the tasks left.`;
  }
  restoreStartingFiles(dir, task);
  const grade = gradeRun(dir, task, spec);
  const result = { task, condition, repeat, dir, ...grade, errored: agent.error, pass: grade.pass && !agent.error, agent };
  results.push(result);
  appendFileSync(jsonl, `${JSON.stringify(result)}\n`);
  log(`${line(result)}  ← ${name}`);
}

const out = join(WORK, 'results', `${stamp}.json`);
writeFileSync(out, JSON.stringify({ stamp, mode, model: args.model ?? 'default', bogrid: base.version, results }, null, 2));
summary(results);
log(`\nResults: ${out}`);

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { tasks: undefined, conditions: ['bare', 'init'], repeat: 1, jobs: 1, model: undefined, solutions: false, untouched: false, build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tasks') o.tasks = argv[++i]?.split(',');
    else if (a === '--conditions') o.conditions = argv[++i]?.split(',') ?? [];
    else if (a === '--repeat') o.repeat = Number(argv[++i]);
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--jobs') o.jobs = Number(argv[++i]);
    else if (a === '--solutions') o.solutions = true;
    else if (a === '--untouched') o.untouched = true;
    else if (a === '--no-build') o.build = false;
    else fail(`Unknown option ${a}. Options: --tasks a,b  --conditions bare,init  --repeat N  --jobs N  --model <name>  --solutions  --untouched  --no-build`);
  }
  if (!o.conditions.length || o.conditions.some((c) => c !== 'bare' && c !== 'init')) fail('--conditions takes bare, init or both.');
  if (!Number.isInteger(o.repeat) || o.repeat < 1) fail('--repeat takes a whole number of 1 or more.');
  if (!Number.isInteger(o.jobs) || o.jobs < 1) fail('--jobs takes a whole number of 1 or more.');
  if (o.solutions && o.untouched) fail('Pick one of --solutions and --untouched.');
  return o;
}

/** The app's dependencies, installed once, and bo-grid packed from this
    repository (its working tree, committed or not) and installed fresh. */
function prepareBase() {
  const dir = join(WORK, 'base');
  if (args.build) {
    log('Building bo-grid (pnpm package)…');
    sh('pnpm', ['package'], { cwd: ROOT });
  }
  const packed = join(WORK, 'pack');
  rmSync(packed, { recursive: true, force: true });
  mkdirSync(packed, { recursive: true });
  sh('npm', ['pack', '--pack-destination', packed, '--silent'], { cwd: ROOT });
  const tarball = join(packed, readdirSync(packed).find((f) => f.endsWith('.tgz')));
  mkdirSync(dir, { recursive: true });
  cpSync(join(EVALS, 'template', 'package.json'), join(dir, 'package.json'));
  const b = { dir, tarball };
  installBase(b);
  b.version = JSON.parse(readFileSync(join(dir, 'node_modules', 'bo-grid', 'package.json'), 'utf8')).version;
  b.fingerprint = fingerprint(dir);
  log(`bo-grid ${b.version} installed from ${tarball}`);
  return b;
}

function installBase(b) {
  if (!existsSync(join(b.dir, 'node_modules', 'vitest'))) {
    log('Installing the app’s dependencies…');
    sh('npm', ['install', '--no-audit', '--no-fund', '--silent'], { cwd: b.dir });
  }
  sh('npm', ['install', '--no-audit', '--no-fund', '--silent', '--no-save', b.tarball], { cwd: b.dir });
}

function reinstallBase() {
  log('  The run changed the shared node_modules: reinstalling it.');
  rmSync(join(base.dir, 'node_modules'), { recursive: true, force: true });
  installBase(base);
  base.fingerprint = fingerprint(base.dir);
}

/** The installed packages, and every file of bo-grid with its size and time:
    a run that changes them is caught. */
function fingerprint(dir) {
  const nm = join(dir, 'node_modules');
  const hash = createHash('sha1').update(readdirSync(nm).sort().join('\n'));
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const s = statSync(p);
        hash.update(`${relative(nm, p)}:${s.size}:${s.mtimeMs}\n`);
      }
    }
  };
  walk(join(nm, 'bo-grid'));
  return hash.digest('hex');
}

/** A fresh copy of the app with the task's files, its own git repository (so
    the agent sees one project, and `git diff` shows its change), and the
    shared node_modules linked in. */
function setupRun(dir, task, condition) {
  mkdirSync(dir, { recursive: true });
  writeStartingFiles(dir, task, () => true);
  symlinkSync(join(base.dir, 'node_modules'), join(dir, 'node_modules'), 'junction');
  const git = (...a) => sh('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-c', 'user.name=eval', '-c', 'user.email=eval@localhost', ...a], { cwd: dir });
  git('init', '-q');
  if (condition === 'init') {
    sh(process.execPath, [join(dir, 'node_modules', 'bo-grid', 'dist', 'cli', 'bin.js'), 'init'], { cwd: dir });
    writeFileSync(join(dir, 'CLAUDE.md'), '@AGENTS.md\n');
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'start');
}

/** The template and the task's files, filtered; package.json as
    `npm i bo-grid` leaves it. */
function writeStartingFiles(dir, task, keep) {
  const filter = (root) => (src) => keep(relative(root, src).replace(/\\/g, '/'));
  cpSync(join(EVALS, 'template'), dir, { recursive: true, filter: filter(join(EVALS, 'template')) });
  const files = join(EVALS, 'tasks', task, 'files');
  if (existsSync(files)) cpSync(files, dir, { recursive: true, filter: filter(files) });
  const pkg = JSON.parse(readFileSync(join(EVALS, 'template', 'package.json'), 'utf8'));
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ ...pkg, dependencies: { 'bo-grid': `^${base.version}` } }, null, 2)}\n`);
}

/** Puts back every starting file but src/App.svelte, so the graders read the
    config and data the task gave, not ones the agent changed. */
function restoreStartingFiles(dir, task) {
  writeStartingFiles(dir, task, (path) => path !== 'src/App.svelte');
}

/** Runs the agent, keeping its event stream (`.agent-trace.jsonl`): every tool
    call it made, then the result with what it cost. */
async function runAgent(dir, prompt) {
  const argv = [
    '-p', '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project,local', '--strict-mcp-config', '--no-session-persistence',
    '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
    ...(args.model ? ['--model', args.model] : []),
    '--disallowedTools', ...DISALLOWED_TOOLS,
    '--allowedTools', ...ALLOWED_TOOLS,
  ];
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(ANTHROPIC_|CLAUDE_)/.test(k) || !SECRET_ENV.test(k)));
  const started = Date.now();
  const r = await spawnAsync('claude', argv, { cwd: dir, env, input: prompt, timeout: AGENT_TIMEOUT });
  writeFileSync(join(dir, '.agent-trace.jsonl'), r.stdout ?? '');
  if (r.error) return { error: r.error.code === 'ETIMEDOUT' ? `timed out after ${AGENT_TIMEOUT / 60_000} minutes` : r.error.message, ms: Date.now() - started };
  const events = (r.stdout ?? '').split('\n').flatMap((l) => {
    try {
      return l.trim() ? [JSON.parse(l)] : [];
    } catch {
      return [];
    }
  });
  const json = events.findLast((e) => e.type === 'result');
  if (!json) return { error: (r.stderr || r.stdout || 'no output').trim().slice(0, 500), ms: Date.now() - started };
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? {};
  const uses = events.flatMap((e) => (e.type === 'assistant' ? (e.message?.content ?? []).filter((c) => c.type === 'tool_use') : []));
  const u = json.usage ?? {};
  return {
    error: json.is_error ? String(json.result ?? json.subtype).slice(0, 500) : undefined,
    cost: json.total_cost_usd,
    turns: json.num_turns,
    ms: json.duration_ms ?? Date.now() - started,
    tokens: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
    models: Object.keys(json.modelUsage ?? {}),
    denied: (json.permission_denials ?? []).map((d) => `${d.tool_name}: ${JSON.stringify(d.tool_input).slice(0, 200)}`),
    tools: Object.fromEntries(Object.entries(Object.groupBy(uses, (c) => c.name)).map(([name, list]) => [name, list.length])),
    read: readsOf(uses),
    context: { skills: init.skills, agents: init.agents, plugins: (init.plugins ?? []).map((p) => p.name) },
  };
}

/** Which bo-grid sources the agent's tool calls touched. */
function readsOf(uses) {
  const touched = (re) => uses.some((c) => re.test(JSON.stringify(c.input ?? {})));
  return {
    docs: touched(/bo-grid[\\/]+dist[\\/]+docs/),
    skill: uses.some((c) => c.name === 'Skill' && /bo-grid/.test(JSON.stringify(c.input))) || touched(/SKILL\.md/),
    agentsMd: touched(/AGENTS\.md/),
    types: touched(/bo-grid[\\/]+dist[\\/]+\S*\.d\.ts/),
    online: uses.some((c) => c.name === 'WebFetch' || c.name === 'WebSearch'),
  };
}

function applySolution(dir, task) {
  const from = join(EVALS, 'solutions', task);
  if (!existsSync(from)) fail(`No solution in evals/solutions/${task}.`);
  cpSync(from, dir, { recursive: true });
  return {};
}

/** Type check, the task's checks on the source, then its behaviour tests
    (copied in only now). `pass` needs all three; idioms are reported apart. */
function gradeRun(dir, task, spec) {
  const typecheck = run(process.execPath, [join(dir, 'node_modules', 'svelte-check', 'bin', 'svelte-check'), '--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'machine'], dir);
  const source = sources(join(dir, 'src')).join('\n');
  const rule = ({ name, match, absent }) => ({ name, pass: match ? new RegExp(match, 'm').test(source) : !new RegExp(absent, 'm').test(source) });
  const checks = (spec.checks ?? []).map(rule);
  const idioms = (spec.idioms ?? []).map(rule);

  const evalDir = join(dir, 'src', '__eval__');
  mkdirSync(evalDir, { recursive: true });
  cpSync(join(EVALS, 'check', 'setup.ts'), join(evalDir, 'setup.ts'));
  cpSync(join(EVALS, 'tasks', task, 'check.test.ts'), join(evalDir, 'check.test.ts'));
  cpSync(join(EVALS, 'check', 'vitest.config.ts'), join(dir, 'vitest.eval.config.ts'));
  const report = join(dir, '.vitest.json');
  rmSync(report, { force: true });
  const vitest = run(process.execPath, [join(dir, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--config', 'vitest.eval.config.ts', '--reporter=json', `--outputFile=${report}`], dir);
  const tests = { total: 0, passed: 0, failures: [] };
  try {
    const v = JSON.parse(readFileSync(report, 'utf8'));
    tests.total = v.numTotalTests;
    tests.passed = v.numPassedTests;
    for (const file of v.testResults ?? [])
      for (const t of file.assertionResults ?? []) if (t.status !== 'passed') tests.failures.push(`${t.title}: ${(t.failureMessages?.[0] ?? '').split('\n')[0]}`);
    if (!tests.total) tests.failures.push((v.testResults?.[0]?.message ?? 'the tests did not run').split('\n')[0]);
  } catch {
    tests.failures.push(vitest.timedOut ? `the tests timed out after ${GRADE_TIMEOUT / 60_000} minutes` : 'the tests did not run');
  }
  const pass = typecheck.ok && checks.every((c) => c.pass) && tests.total > 0 && tests.passed === tests.total;
  return { pass, typecheck: typecheck.ok, typeErrors: typecheck.ok ? undefined : typecheck.out.slice(-1500), checks, idioms, tests };
}

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__eval__' ? [] : sources(p);
    return /\.(svelte|ts|js)$/.test(e.name) ? [readFileSync(p, 'utf8')] : [];
  });
}

function line(r) {
  const head = r.errored ? '! error' : r.pass ? '✓ pass ' : '✗ fail ';
  const cost = r.agent.cost != null ? ` · $${r.agent.cost.toFixed(2)} · ${r.agent.turns} turns` : '';
  const error = r.errored ? `\n    agent: ${r.errored}` : '';
  return `  ${head} typecheck ${r.typecheck ? '✓' : '✗'} · checks ${count(r.checks)} · tests ${r.tests.passed}/${r.tests.total} · idioms ${count(r.idioms)}${cost}${error}`;
}

/** Per condition: passes out of the runs that completed (an errored run is
    the agent's or the harness's failure, not a result), then what they cost. */
function summary(rs) {
  const agentRan = rs.some((r) => r.agent.cost != null);
  log(agentRan ? '\n                 pass   cost/run  tokens/run        turns   idioms   errored' : '\n                 pass   idioms');
  for (const [condition, list] of Object.entries(Object.groupBy(rs, (r) => r.condition))) {
    const done = list.filter((r) => !r.errored);
    const withAgent = done.filter((r) => r.agent.cost != null);
    const avg = (f) => withAgent.reduce((s, r) => s + f(r), 0) / withAgent.length;
    const tokens = (r) => r.agent.tokens.input + r.agent.tokens.cacheRead + r.agent.tokens.cacheWrite + r.agent.tokens.output;
    const idioms = done.flatMap((r) => r.idioms);
    const passed = `${done.filter((r) => r.pass).length}/${done.length}`.padEnd(6);
    const idiomsPassed = `${idioms.filter((i) => i.pass).length}/${idioms.length}`.padEnd(8);
    if (!agentRan) log(`  ${condition.padEnd(14)} ${passed} ${idiomsPassed}`);
    else
      log(
        `  ${condition.padEnd(14)} ${passed} ${(withAgent.length ? `$${avg((r) => r.agent.cost).toFixed(2)}` : '-').padEnd(9)} ` +
          `${(withAgent.length ? String(Math.round(avg(tokens))) : '-').padEnd(17)} ${(withAgent.length ? avg((r) => r.agent.turns).toFixed(1) : '-').padEnd(7)} ${idiomsPassed} ${list.length - done.length}`,
      );
  }
  if (agentRan) {
    log('\n  what the agents read (runs):');
    for (const [condition, list] of Object.entries(Object.groupBy(rs.filter((r) => r.agent.read), (r) => r.condition))) {
      const n = (key) => `${list.filter((r) => r.agent.read[key]).length}/${list.length}`;
      log(`  ${condition.padEnd(14)} docs ${n('docs')} · skill ${n('skill')} · AGENTS.md ${n('agentsMd')} · types ${n('types')} · online ${n('online')}`);
    }
  }
  const total = rs.reduce((s, r) => s + (r.agent.cost ?? 0), 0);
  if (total) log(`  total cost $${total.toFixed(2)} over ${rs.length} runs`);
  for (const r of rs.filter((x) => !x.pass))
    log(`  ${r.errored ? '!' : '✗'} ${r.task} · ${r.condition}: ${[r.errored && `agent: ${r.errored}`, !r.typecheck && 'type errors', ...r.checks.filter((c) => !c.pass).map((c) => c.name), ...r.tests.failures].filter(Boolean).join('; ')}`);
}

/** Runs a command, showing its output; stops the evals if it fails (the
    results so far are in the .jsonl file). npm and pnpm are .cmd scripts on
    Windows, which only a shell can start. */
function sh(cmd, argv, opts) {
  const viaShell = process.platform === 'win32' && (cmd === 'npm' || cmd === 'pnpm');
  const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  const r = viaShell ? spawnSync([cmd, ...argv].map(quote).join(' '), { stdio: 'inherit', shell: true, ...opts }) : spawnSync(cmd, argv, { stdio: 'inherit', ...opts });
  if (r.status !== 0) fail(`${cmd} ${argv.join(' ')} failed (exit ${r.status}).`);
}
/** Like spawnSync, but the other runs go on meanwhile. */
function spawnAsync(cmd, argv, { input, timeout, ...opts }) {
  return new Promise((done) => {
    const out = [];
    const err = [];
    let error;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      done({ error, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
    };
    const child = spawn(cmd, argv, { ...opts, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
      child.kill();
    }, timeout);
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.stdin.on('error', () => {}); // the process may be gone before it reads
    child.on('error', (e) => {
      error = e;
      finish();
    });
    child.on('close', finish);
    child.stdin.end(input);
  });
}
function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', timeout: GRADE_TIMEOUT, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, timedOut: r.error?.code === 'ETIMEDOUT', out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
function log(s) {
  console.log(s);
}
function count(list) {
  return `${list.filter((c) => c.pass).length}/${list.length}`;
}
function fail(message) {
  console.error(`✗ ${message}`);
  if (jsonl && existsSync(jsonl)) console.error(`Results so far: ${jsonl}`);
  process.exit(1);
}

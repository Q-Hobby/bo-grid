// Smoke-test the `bo-grid` command from the built package (run after
// `pnpm package`): `npx bo-grid init` in an empty project writes AGENTS.md and
// the skill, a second run changes nothing, and bad usage exits 2. The unit
// tests (src/lib/cli/init.test.ts) cover the logic; this covers what only the
// build shows: the bin's shebang, its imports and the texts it reads beside it.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const bin = resolve(pkg.bin['bo-grid']);
const fail = (message) => {
  console.error(`✗ smoke-cli: ${message}`);
  process.exit(1);
};

if (!readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')) fail(`${bin} does not start with a node shebang`);

const project = mkdtempSync(join(tmpdir(), 'bo-grid-init-'));
try {
  mkdirSync(join(project, 'node_modules', 'bo-grid'), { recursive: true });
  const init = (...args) => execFileSync(process.execPath, [bin, 'init', ...args], { cwd: project, encoding: 'utf8' });

  const first = init();
  if (!/created\s+AGENTS\.md/.test(first) || !/created\s+\.claude\/skills\/bo-grid\/SKILL\.md/.test(first)) fail(`unexpected first run:\n${first}`);
  const agents = readFileSync(join(project, 'AGENTS.md'), 'utf8');
  if (!agents.includes('<!-- bo-grid:start') || !agents.includes('node_modules/bo-grid/dist/docs/README.md')) fail('AGENTS.md lacks the section');
  if (readFileSync(join(project, '.claude/skills/bo-grid/SKILL.md'), 'utf8') !== readFileSync('dist/skills/bo-grid/SKILL.md', 'utf8'))
    fail('the installed skill differs from dist/skills/bo-grid/SKILL.md');

  const again = JSON.parse(init('--json'));
  if (!again.files.every((f) => f.status === 'unchanged')) fail(`a second run changed files: ${JSON.stringify(again.files)}`);

  const bad = spawnSync(process.execPath, [bin, 'init', '--force'], { cwd: project, encoding: 'utf8' });
  if (bad.status !== 2 || !bad.stderr.includes('Unknown option "--force".')) fail(`bad usage exited ${bad.status}: ${bad.stderr}`);
} finally {
  rmSync(project, { recursive: true, force: true });
}
console.log('✓ smoke-cli: npx bo-grid init writes AGENTS.md and the skill, and a second run changes nothing');

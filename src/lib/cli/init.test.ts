import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { END, START, USAGE, main, parseArgs, withSection, type CliEnv } from './init';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const assets = { section: read('./agents-section.md'), skill: read('../skills/bo-grid/SKILL.md') };

/** Runs the command on a project in memory: path → text, where a path ending
    in `/` is a folder. `failOn` makes writing that path throw. */
function run(argv: string[], start: Record<string, string> = { 'node_modules/bo-grid/': '' }, failOn?: string) {
  const files = new Map(Object.entries(start));
  const writes: string[] = [];
  let out = '';
  let err = '';
  const env: CliEnv = {
    assets,
    project: (cwd) => {
      const at = (path: string) => (path === '.' ? cwd : cwd === '.' ? path : `${cwd}/${path}`);
      return {
        exists: (path) => files.has(at(path)) || files.has(`${at(path)}/`),
        isDirectory: (path) => at(path) === '.' || files.has(`${at(path)}/`) || [...files.keys()].some((k) => k.startsWith(`${at(path)}/`)),
        read: (path) => files.get(at(path)),
        write: (path, text) => {
          if (at(path) === failOn) throw new Error(`EACCES: permission denied, open '${path}'`);
          writes.push(at(path));
          files.set(at(path), text);
        },
      };
    },
    out: (text) => (out += text),
    err: (text) => (err += text),
  };
  const code = main(argv, env);
  return { code, files, writes, out, err };
}

describe('withSection', () => {
  const section = '## bo-grid\n\nRead the docs.\n';
  const block = `${START}\n## bo-grid\n\nRead the docs.\n${END}`;

  it('creates the file with the section between markers', () => {
    expect(withSection(undefined, section)).toEqual({ text: `${block}\n`, status: 'created' });
  });

  it('adds the section after what the file has, with one blank line between', () => {
    expect(withSection('# My app\n', section).text).toBe(`# My app\n\n${block}\n`);
    expect(withSection('# My app', section).text).toBe(`# My app\n\n${block}\n`);
    expect(withSection('# My app\n\n', section).text).toBe(`# My app\n\n${block}\n`);
    expect(withSection('', section).text).toBe(`${block}\n`);
  });

  it('replaces only its own section, and reports a second run as unchanged', () => {
    const before = `# My app\n\n${START}\nold text\n${END}\n\n## Testing\nRun pnpm test.\n`;
    const once = withSection(before, section);
    expect(once).toEqual({ text: `# My app\n\n${block}\n\n## Testing\nRun pnpm test.\n`, status: 'updated' });
    expect(withSection(once.text, section)).toEqual({ text: once.text, status: 'unchanged' });
  });

  it('keeps the line endings: Windows, and mixed', () => {
    const { text } = withSection('# My app\r\n', section);
    expect(text).toBe(`# My app\r\n\r\n${block.replace(/\n/g, '\r\n')}\r\n`);
    expect(withSection(text, section).status).toBe('unchanged');
    expect(withSection('a\r\nb\n', section).text).toBe(`a\r\nb\n\r\n${block.replace(/\n/g, '\r\n')}\r\n`);
  });

  it('writes `$` patterns in the section literally', () => {
    const odd = "## bo-grid\nCost: $& and $1 and $'\n";
    const first = withSection(`${START}\nold\n${END}\n`, odd).text;
    expect(first).toBe(`${START}\n${odd.trim()}\n${END}\n`);
  });

  it('leaves the file alone when its markers do not pair up, so no text between them is lost', () => {
    const orphanStart = `a\n${START}\nuser stuff\n## more\n`;
    expect(withSection(orphanStart, section)).toMatchObject({ text: orphanStart, status: 'conflict' });
    const orphanEnd = `notes\n${END}\nmore notes\n`;
    expect(withSection(orphanEnd, section)).toMatchObject({ text: orphanEnd, status: 'conflict' });
    const twice = `${block}\n\nmine\n\n${block}\n`;
    expect(withSection(twice, section)).toMatchObject({ text: twice, status: 'conflict' });
    const backwards = `${END}\nmine\n${START}\n`;
    expect(withSection(backwards, section).status).toBe('conflict');
    expect(withSection(orphanStart, section).reason).toContain("markers don't pair up (1 start, 0 end)");
  });

  it('ignores markers in a code fence or in a sentence', () => {
    const fenced = `How init marks its section:\n\n\`\`\`md\n${START}\n...\n${END}\n\`\`\`\n`;
    expect(withSection(fenced, section)).toEqual({ text: `${fenced}\n${block}\n`, status: 'updated' });
    const prose = `We use \`${START}\` and ${END} as markers.\n`;
    expect(withSection(prose, section)).toEqual({ text: `${prose}\n${block}\n`, status: 'updated' });
  });

  it('leaves a bo-grid section pasted from the docs alone, and says on which line', () => {
    for (const text of ['# App\n\n## bo-grid (data grid)\nRead it.\n', '## bo-grid (Svelte 5 data grid)\n', 'Read node_modules/bo-grid/dist/docs/README.md first.\n'])
      expect(withSection(text, section)).toMatchObject({ text, status: 'conflict' });
    expect(withSection('# App\n\n## bo-grid (data grid)\n', section).reason).toContain('(line 3)');
  });

  it('does not take other mentions of bo-grid for a pasted section', () => {
    for (const text of ['We chose bo-grid for the tables.\n', '## bo-grid upgrade plan\n', 'tsconfig paths point at node_modules/bo-grid/src.\n'])
      expect(withSection(text, section).status).toBe('updated');
  });
});

describe('parseArgs', () => {
  it('reads the options, in both --flag value and --flag=value forms', () => {
    const parsed = parseArgs(['init', '--file', 'CLAUDE.md', '--file=AGENTS.md', '--cwd=app', '--skills-dir', '.agents/skills', '--no-skill', '--dry-run', '--json']);
    expect(parsed).toEqual({
      command: 'init',
      options: { cwd: 'app', files: ['CLAUDE.md', 'AGENTS.md'], skill: false, skillsDir: '.agents/skills', dryRun: true, json: true },
    });
  });

  it('defaults to AGENTS.md and .claude/skills', () => {
    expect(parseArgs(['init'])).toEqual({
      command: 'init',
      options: { cwd: '.', files: ['AGENTS.md'], skill: true, skillsDir: '.claude/skills', dryRun: false, json: false },
    });
  });

  it('says what is wrong with bad usage', () => {
    expect(parseArgs([])).toEqual({ error: 'Missing the command.' });
    expect(parseArgs(['install'])).toEqual({ error: 'Unknown command "install".' });
    expect(parseArgs(['init', '--force'])).toEqual({ error: 'Unknown option "--force".' });
    expect(parseArgs(['init', '--file'])).toEqual({ error: '--file needs a value, such as --file CLAUDE.md.' });
    expect(parseArgs(['init', '--file='])).toEqual({ error: '--file needs a value, such as --file CLAUDE.md.' });
    expect(parseArgs(['init', '--cwd', '--json'])).toEqual({ error: '--cwd needs a value, such as --cwd ./app.' });
    expect(parseArgs(['init', '--cwd', 'a', '--cwd', 'b'])).toEqual({ error: '--cwd is given twice.' });
    expect(parseArgs(['init', '--json=false'])).toEqual({ error: '--json takes no value.' });
  });
});

describe('npx bo-grid init', () => {
  it('writes the section and the skill, then finds nothing to change', () => {
    const first = run(['init']);
    expect(first.code).toBe(0);
    expect(first.out).toBe('  created  AGENTS.md\n  created  .claude/skills/bo-grid/SKILL.md\n');
    expect(first.files.get('AGENTS.md')).toBe(`${START}\n${assets.section.trim()}\n${END}\n`);
    expect(first.files.get('.claude/skills/bo-grid/SKILL.md')).toBe(assets.skill);

    const again = run(['init'], Object.fromEntries(first.files));
    expect(again.code).toBe(0);
    expect(again.writes).toEqual([]);
    expect(again.out).toBe('  unchanged  AGENTS.md\n  unchanged  .claude/skills/bo-grid/SKILL.md\n');
  });

  it('writes nothing on a dry run, and still reports a conflict', () => {
    const { code, writes, out } = run(['init', '--dry-run'], { 'node_modules/bo-grid/': '', 'AGENTS.md': `${START}\n` });
    expect(code).toBe(1);
    expect(writes).toEqual([]);
    expect(out).toContain('  conflict  AGENTS.md');
    expect(out).toContain('Dry run: nothing was written.');
  });

  it('prints the result as JSON', () => {
    const { out } = run(['init', '--json', '--no-skill', '--file', 'CLAUDE.md']);
    expect(JSON.parse(out)).toEqual({ dryRun: false, files: [{ path: 'CLAUDE.md', status: 'created' }], notes: [] });
  });

  it('works on another folder with --cwd, and refuses one that does not exist', () => {
    const { files } = run(['init', '--cwd', 'apps/web', '--no-skill'], { 'apps/web/node_modules/bo-grid/': '' });
    expect(files.has('apps/web/AGENTS.md')).toBe(true);
    const typo = run(['init', '--cwd', 'aps/web'], { 'apps/web/node_modules/bo-grid/': '' });
    expect(typo.code).toBe(2);
    expect(typo.writes).toEqual([]);
    expect(typo.err).toContain('--cwd aps/web is not a folder.');
  });

  it('installs the skill under --skills-dir, with or without a trailing slash', () => {
    expect(run(['init', '--skills-dir', '.agents/skills/']).writes).toContain('.agents/skills/bo-grid/SKILL.md');
    expect(run(['init', '--skills-dir', '.agents\\skills']).writes).toContain('.agents/skills/bo-grid/SKILL.md');
  });

  it('exits 1 and leaves a pasted section alone, naming the line', () => {
    const pasted = '# Rules\n\n## bo-grid (data grid)\nOld rules.\n';
    const { code, files, out } = run(['init', '--no-skill'], { 'node_modules/bo-grid/': '', 'AGENTS.md': pasted });
    expect(code).toBe(1);
    expect(files.get('AGENTS.md')).toBe(pasted);
    expect(out).toContain('  conflict  AGENTS.md');
    expect(out).toContain('Note: AGENTS.md was left alone: it has a bo-grid section that init did not write (line 3)');
  });

  it('leaves alone a folder given as --file, and text that is not UTF-8', () => {
    const { code, out } = run(['init', '--no-skill', '--file', 'docs', '--file', 'NOTES.md'], {
      'node_modules/bo-grid/': '',
      'docs/': '',
      'NOTES.md': 'caf�\n',
    });
    expect(code).toBe(1);
    expect(out).toContain('Note: docs was left alone: it is a folder.');
    expect(out).toContain('Note: NOTES.md was left alone: it is not UTF-8 text.');
  });

  it('writes the other files when one cannot be written, and reports which', () => {
    const { code, files, out } = run(['init', '--json'], { 'node_modules/bo-grid/': '' }, '.claude/skills/bo-grid/SKILL.md');
    expect(code).toBe(1);
    expect(files.has('AGENTS.md')).toBe(true);
    expect(JSON.parse(out).files).toEqual([
      { path: 'AGENTS.md', status: 'created' },
      { path: '.claude/skills/bo-grid/SKILL.md', status: 'failed', reason: "EACCES: permission denied, open '.claude/skills/bo-grid/SKILL.md'" },
    ]);
  });

  it('notes a missing install, and a CLAUDE.md that does not import AGENTS.md', () => {
    const { out } = run(['init', '--no-skill'], { 'CLAUDE.md': '# Rules\n' });
    expect(out).toContain('Note: node_modules/bo-grid is not in this folder');
    expect(out).toContain('Note: CLAUDE.md does not import AGENTS.md');
    expect(run(['init', '--no-skill'], { 'node_modules/bo-grid/': '', 'CLAUDE.md': '@AGENTS.md\n' }).out).not.toContain('Note:');
  });

  it('exits 2 with the reason and the usage on bad usage, and 0 for help', () => {
    const bad = run(['init', '--force']);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('Unknown option "--force".');
    expect(bad.err).toContain(USAGE);
    expect(run(['--help']).out).toBe(USAGE);
    expect(run(['init', '-h']).code).toBe(0);
  });
});

describe('the texts init writes', () => {
  it('the section is the one the AI docs page shows', () => {
    const page = read('../../../site/src/routes/(docs)/docs/ai/+page.md');
    const shown = /## Add bo-grid to your AGENTS\.md\n[\s\S]*?```md\n([\s\S]*?)\n```/.exec(page)?.[1];
    expect(shown).toBe(assets.section.trimEnd());
  });

  it('the skill has a name and a description an agent can match', () => {
    const front = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(assets.skill);
    expect(front?.[1]).toBe('bo-grid');
    expect(front?.[2].length).toBeGreaterThan(50);
    expect(front?.[2].length).toBeLessThanOrEqual(1024);
  });
});

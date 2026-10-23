// Prints the CHANGELOG section of one version: the notes of its GitHub
// release (.github/workflows/release.yml). Fails when CHANGELOG.md has no
// section, or an empty one, for that version, so a version cannot ship
// without its notes.
// Usage: node scripts/release-notes.mjs 2.4.0 [CHANGELOG.md]
import { readFileSync } from 'node:fs';

const [version, file = 'CHANGELOG.md'] = process.argv.slice(2);
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version> [changelog]');
  process.exit(2);
}

const lines = readFileSync(file, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start < 0) {
  console.error(`✗ ${file} has no "## [${version}]" section. Date the release's section before it ships.`);
  process.exit(1);
}
// The section runs to the next version heading, or to the link references at
// the end of the file.
let end = lines.findIndex((l, i) => i > start && (l.startsWith('## [') || /^\[[^\]]+\]: /.test(l)));
if (end < 0) end = lines.length;
const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
  console.error(`✗ The "## [${version}]" section of ${file} is empty.`);
  process.exit(1);
}
console.log(body);

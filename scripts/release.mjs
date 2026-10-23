// Release helper: runs every quality gate, shows the tarball, then publishes.
// CI does this on its own when a version bump merges to main
// (.github/workflows/release.yml); this is the way by hand.
// Usage:
//   pnpm release          # run gates + publish to npm + tag
//   pnpm release:dry      # run gates + `npm publish --dry-run` (no publish)
//
// You must be logged in to npm (`npm login`) for a real publish.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dry = process.argv.includes('--dry-run');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

function run(cmd) {
  console.log(`\n[36m$ ${cmd}[0m`);
  execSync(cmd, { stdio: 'inherit' });
}
function capture(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

console.log(`\n▶ Releasing ${pkg.name}@${pkg.version}${dry ? '  (dry run)' : ''}\n`);

// 1. Require a clean working tree for a real publish.
if (!dry) {
  const status = capture('git status --porcelain');
  if (status) {
    console.error('✗ Working tree is not clean — commit or stash first:\n' + status);
    process.exit(1);
  }
  const branch = capture('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    console.error(`✗ On branch "${branch}", expected "main".`);
    process.exit(1);
  }
}

// 2. Quality gates (any failure aborts the release).
run('pnpm check');
run('pnpm test');
run('pnpm ssr');
run('pnpm package');
run('pnpm smoke');
run('pnpm smoke:wc');
run('pnpm size');
run('pnpm size:lib');

// 3. Show exactly what will be published.
run('npm pack --dry-run');

// 4. Publish.
if (dry) {
  run('npm publish --dry-run --access public');
  console.log('\n✓ Dry run complete. Re-run `pnpm release` (no --dry-run) to publish.');
} else {
  run('npm publish --access public');
  run(`git tag v${pkg.version}`);
  console.log(`\n✓ Published ${pkg.name}@${pkg.version} and tagged v${pkg.version}.`);
  console.log('  Next: git push && git push --tags');
}

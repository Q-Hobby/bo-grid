#!/usr/bin/env node
// The `bo-grid` command (`npx bo-grid init`). The logic is in init.js; this
// file gives it the file system and the texts it writes.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { main } from './init.js';

const asset = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

process.exitCode = main(process.argv.slice(2), {
  assets: { section: asset('./agents-section.md'), skill: asset('../skills/bo-grid/SKILL.md') },
  project(cwd) {
    const at = (path) => resolve(cwd, path);
    return {
      exists: (path) => existsSync(at(path)),
      isDirectory: (path) => statSync(at(path), { throwIfNoEntry: false })?.isDirectory() ?? false,
      read: (path) => (existsSync(at(path)) ? readFileSync(at(path), 'utf8') : undefined),
      write(path, text) {
        mkdirSync(dirname(at(path)), { recursive: true });
        writeFileSync(at(path), text);
      },
    };
  },
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});

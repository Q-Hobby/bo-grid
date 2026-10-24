import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  plugins: [sveltekit()],
  define: { __BO_GRID_VERSION__: JSON.stringify(version) },
  // The site reads the library and the examples from the repository above it.
  server: { port: 5190, fs: { allow: ['..'] } },
});

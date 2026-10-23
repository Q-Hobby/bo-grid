import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Builds the library as a single bundle with Svelte (the peer) and the optional
// xlsx peer externalized — i.e. what a consumer actually pays on top of Svelte.
// Used only to measure size; the published package ships unbundled via
// @sveltejs/package (see the `package` script).
export default defineConfig({
  plugins: [svelte()],
  // This build measures the library only — repo-root public/ (the demo
  // site's llms.txt) has no business here; see vite.wc.config.ts for the
  // same reasoning where it actually matters (that one ships to npm).
  publicDir: false,
  build: {
    outDir: 'lib-dist',
    emptyOutDir: true,
    minify: 'esbuild',
    lib: {
      // Four entries: the grid core plus the optional realtime, trading and
      // ladder companions. Measured separately by size-lib.mjs so each keeps
      // its own budget and none can creep into the core number (the ladder
      // builds on the grid, so it counts only what it adds).
      entry: {
        'bo-grid': 'src/lib/index.ts',
        realtime: 'src/lib/realtime/index.ts',
        trading: 'src/lib/trading/index.ts',
        ladder: 'src/lib/ladder/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['svelte', /^svelte\//, 'xlsx'],
      output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
});

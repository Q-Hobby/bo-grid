import { defineConfig } from 'vite';

// Builds the React and Vue wrappers (bo-grid/react, bo-grid/vue) beside the
// custom element in dist/. A build of their own, so the element stays one
// self-contained file: each wrapper loads it on the client with
// `import('./bo-grid.element.js')`. React and Vue are the app's own (optional
// peers), never bundled.
const isElement = (id: string): boolean => /(^\.\/element|[\\/]src[\\/]wc[\\/]element(\.ts)?)$/.test(id);

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    lib: {
      entry: { react: 'src/wc/react.ts', vue: 'src/wc/vue.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => id === 'react' || id === 'vue' || isElement(id),
      output: {
        entryFileNames: 'bo-grid.[name].js',
        paths: (id) => (isElement(id) ? './bo-grid.element.js' : id),
        // A module directive does not survive bundling; the React wrapper is
        // a client component wherever server components exist.
        banner: (chunk) => (chunk.name === 'react' ? "'use client';" : ''),
      },
    },
  },
});

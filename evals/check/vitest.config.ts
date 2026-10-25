// The graders' Vitest config, copied into the app as vitest.eval.config.ts
// after the agent has finished. bo-grid ships .svelte files, so Vitest
// compiles it instead of loading it as plain Node modules.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['src/__eval__/**/*.test.ts'],
    server: { deps: { inline: ['bo-grid'] } },
  },
});

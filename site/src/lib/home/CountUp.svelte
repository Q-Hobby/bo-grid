<script lang="ts">
  import { untrack } from 'svelte';
  import { onScreen } from './reveal';

  // A figure that counts up from zero the first time it scrolls into view.
  let { to, format = (n: number) => Math.round(n).toLocaleString('en-US'), prefix = '', suffix = '' }: { to: number; format?: (n: number) => string; prefix?: string; suffix?: string } = $props();

  let shown = $state(untrack(() => to));
  let started = false;
  function start(visible: boolean): void {
    if (!visible || started) return;
    started = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    const run = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      shown = to * (1 - (1 - k) ** 3);
      if (k < 1) requestAnimationFrame(run);
    };
    shown = 0;
    requestAnimationFrame(run);
  }
</script>

<span use:onScreen={start}>{prefix}{format(shown)}{suffix}</span>

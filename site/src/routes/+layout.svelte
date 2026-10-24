<script lang="ts">
  import '$demo/app.css';
  import '$lib/site.css';
  import { onMount } from 'svelte';
  import { ui } from '$demo/theme.svelte';
  import { prefs } from '$lib/prefs.svelte';
  import TopBar from '$lib/TopBar.svelte';
  import QuickJump from '$lib/QuickJump.svelte';

  let { children } = $props();

  onMount(() => prefs.load());
  // The page's colour scheme follows the theme toggle (app.css reads the class).
  $effect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', ui.theme === 'light');
    root.classList.toggle('dark', ui.theme === 'dark');
  });
</script>

<TopBar />
<QuickJump />
{@render children()}

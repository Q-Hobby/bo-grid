// The reader's framework, remembered: every code tab on the site shows it.
export type Framework = 'svelte' | 'react' | 'vue' | 'js';

export const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: 'svelte', label: 'Svelte' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'js', label: 'JavaScript' },
];

const KEY = 'bo-grid-framework';

function saved(): Framework {
  try {
    const v = localStorage.getItem(KEY);
    return FRAMEWORKS.some((f) => f.id === v) ? (v as Framework) : 'svelte';
  } catch {
    return 'svelte';
  }
}

class Prefs {
  framework = $state<Framework>('svelte');
  /** Reads the saved choice, once in the browser. */
  load(): void {
    this.framework = saved();
  }
  set(f: Framework): void {
    this.framework = f;
    try {
      localStorage.setItem(KEY, f);
    } catch {
      // storage blocked: the choice holds for this visit
    }
  }
}

export const prefs = new Prefs();

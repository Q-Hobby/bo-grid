// Saved grid layout (`persistKey`) in localStorage, one entry per part:
// `bo-grid:<part>:<persistKey>`. Every read and write is guarded: storage can
// be missing (SSR, some privacy modes) or full, and a saved value can be
// corrupt or from an older shape, so callers validate what comes back.

/** The storage key for one part of the layout, or null without a persistKey. */
export function storageKey(part: string, persistKey: string | undefined): string | null {
  return persistKey ? `bo-grid:${part}:${persistKey}` : null;
}

/** The parsed saved value, or undefined when there is none or it is unreadable. */
export function loadSaved(key: string | null): unknown {
  if (!key || typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined; // corrupt value or storage blocked
  }
}

/** Saves a value; a failure (no storage, quota) only means it is not kept. */
export function saveValue(key: string | null, value: unknown): void {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the value still applies this session */
  }
}

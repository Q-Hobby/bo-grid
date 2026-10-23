// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSaved, saveValue, storageKey } from './persist';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('storageKey', () => {
  it('namespaces each part under the persistKey', () => {
    expect(storageKey('widths', 'board')).toBe('bo-grid:widths:board');
  });
  it('is null without a persistKey', () => {
    expect(storageKey('widths', undefined)).toBeNull();
    expect(storageKey('widths', '')).toBeNull();
  });
});

describe('loadSaved / saveValue', () => {
  it('round-trips a value', () => {
    saveValue('k', { px: 120 });
    expect(loadSaved('k')).toEqual({ px: 120 });
  });
  it('gives undefined for a missing key, a null key or a corrupt value', () => {
    expect(loadSaved('missing')).toBeUndefined();
    expect(loadSaved(null)).toBeUndefined();
    localStorage.setItem('bad', '{not json');
    expect(loadSaved('bad')).toBeUndefined();
  });
  it('keeps a saved null distinct from a missing entry', () => {
    saveValue('n', null);
    expect(loadSaved('n')).toBeNull();
  });
  it('ignores a null key and a failing store', () => {
    saveValue(null, 1);
    expect(localStorage.length).toBe(0);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveValue('k', 1)).not.toThrow();
  });
  it('treats a store that throws on read as empty', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadSaved('k')).toBeUndefined();
  });
});

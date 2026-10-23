// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { dismissOnOutside } from './dismiss';

describe('dismissOnOutside', () => {
  it('closes on a pointer press, Escape or window blur, not on other keys', () => {
    const close = vi.fn();
    const stop = dismissOnOutside(close);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(close).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    window.dispatchEvent(new MouseEvent('pointerdown'));
    window.dispatchEvent(new Event('blur'));
    expect(close).toHaveBeenCalledTimes(3);
    stop();
  });

  it('listens no more after cleanup', () => {
    const close = vi.fn();
    dismissOnOutside(close)();
    window.dispatchEvent(new MouseEvent('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(close).not.toHaveBeenCalled();
  });
});

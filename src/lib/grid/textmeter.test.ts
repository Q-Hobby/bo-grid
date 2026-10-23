// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { TextMeter } from './textmeter';

function cell(padding: string): HTMLElement {
  const el = document.createElement('div');
  el.style.padding = padding;
  el.style.font = 'italic 600 13px Plex';
  const text = document.createElement('span');
  text.className = 'bo-cell-text';
  text.style.font = '400 12px Mono';
  el.append(text);
  document.body.append(el);
  return el;
}

describe('TextMeter', () => {
  it("reads a column's font from its text and its padding from the cell, once", () => {
    const meter = new TextMeter();
    const find = vi.fn(() => cell('0 8px'));
    const m = meter.metricsFor('px', find);
    expect(m?.pad).toBe(18); // 8 + 8 + 2
    expect(m?.font).toContain('12px');
    meter.metricsFor('px', find);
    expect(find).toHaveBeenCalledTimes(1);
    meter.reset();
    meter.metricsFor('px', find);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('gives null while no cell of the column is rendered', () => {
    expect(new TextMeter().metricsFor('px', () => null)).toBeNull();
  });

  it('estimates a width without a canvas', () => {
    // jsdom has no canvas 2D context.
    expect(new TextMeter().width('1234', '12px Mono')).toBe(30);
  });
});

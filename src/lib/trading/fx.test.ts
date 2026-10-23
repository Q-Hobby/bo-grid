import { describe, expect, it } from 'vitest';
import { fxCentresOpen, fxMarketOpen, fxPipSize, fxQuoteHtml, fxQuoteParts, pipsBetween } from './fx';

describe('fxPipSize', () => {
  it('is 0.01 for yen pairs and 0.0001 otherwise, however the pair is written', () => {
    expect(fxPipSize('USD/JPY')).toBe(0.01);
    expect(fxPipSize('eurjpy')).toBe(0.01);
    expect(fxPipSize('EUR/USD')).toBe(0.0001);
    expect(fxPipSize('gbp_usd')).toBe(0.0001);
    // A broker's suffix does not change the pair.
    expect(fxPipSize('USDJPY.m')).toBe(0.01);
    expect(fxPipSize('EURUSD.pro')).toBe(0.0001);
  });
});

describe('fxQuoteParts and fxQuoteHtml', () => {
  it('cuts a quote into big figure, pips and pipette', () => {
    expect(fxQuoteParts(1.08452, 'EUR/USD')).toEqual({ big: '1.08', pips: '45', pipette: '2' });
    expect(fxQuoteParts(151.234, 'USD/JPY')).toEqual({ big: '151.', pips: '23', pipette: '4' });
    expect(fxQuoteParts(1.0845, 'EUR/USD', { pipette: false })).toEqual({ big: '1.08', pips: '45', pipette: '' });
    // A pip size works where a pair does (gold at 0.01, say).
    expect(fxQuoteParts(2345.678, 0.01)).toEqual({ big: '2345.', pips: '67', pipette: '8' });
  });

  it('pads a short price and leaves nothing for one that is not a number', () => {
    expect(fxQuoteParts(1.1, 'EUR/USD')).toEqual({ big: '1.10', pips: '00', pipette: '0' });
    expect(fxQuoteParts(Number.NaN, 'EUR/USD')).toEqual({ big: '', pips: '', pipette: '' });
    expect(fxQuoteHtml(Number.NaN, 'EUR/USD')).toBe('');
  });

  it('leaves nothing for a pip size it cannot split by, or a price past 1e21', () => {
    const none = { big: '', pips: '', pipette: '' };
    expect(fxQuoteParts(1234.5, 1)).toEqual(none);
    expect(fxQuoteParts(1.5, 0)).toEqual(none);
    expect(fxQuoteParts(1.5, -0.01)).toEqual(none);
    expect(fxQuoteParts(1e21, 'EUR/USD')).toEqual(none);
    expect(fxQuoteHtml(1234.5, 1)).toBe('');
  });

  it('carries a rounding through the pips', () => {
    expect(fxQuoteParts(1.099995, 'EUR/USD')).toEqual({ big: '1.10', pips: '00', pipette: '0' });
  });

  it('renders the parts in classes of their own', () => {
    const html = fxQuoteHtml(1.08452, 'EUR/USD');
    expect(html).toContain('<span class="bo-fx-big" style="opacity:.7">1.08</span>');
    expect(html).toContain('>45</span>');
    expect(html).toContain('<sup class="bo-fx-pipette"');
    expect(fxQuoteHtml(1.0845, 'EUR/USD', { pipette: false })).not.toContain('<sup');
  });
});

describe('pipsBetween', () => {
  it('measures a spread or a move in pips, to a tenth', () => {
    expect(pipsBetween(1.08467, 1.08452, 'EUR/USD')).toBe(1.5);
    expect(pipsBetween(151.2, 151.234, 'USD/JPY')).toBe(-3.4);
  });
});

describe('the FX week', () => {
  // 2026-10-23 is a Friday; New York is on summer time (UTC-4) until 1 Nov.
  const at = (iso: string) => new Date(iso);

  it('opens Sunday 17:00 and closes Friday 17:00, New York time', () => {
    expect(fxMarketOpen(at('2026-10-23T20:59:00Z'))).toBe(true); // Fri 16:59 NY
    expect(fxMarketOpen(at('2026-10-23T21:00:00Z'))).toBe(false); // Fri 17:00 NY
    expect(fxMarketOpen(at('2026-10-24T15:00:00Z'))).toBe(false); // Sat
    expect(fxMarketOpen(at('2026-10-25T20:59:00Z'))).toBe(false); // Sun 16:59 NY
    expect(fxMarketOpen(at('2026-10-25T21:00:00Z'))).toBe(true); // Sun 17:00 NY
    expect(fxMarketOpen(at('2026-10-21T03:00:00Z'))).toBe(true); // midweek
  });

  it('names the centres in business hours, overlaps included', () => {
    // Wed 13:00 UTC: London 14:00 (BST), New York 09:00 (EDT).
    expect(fxCentresOpen(at('2026-10-21T13:00:00Z'))).toEqual(['London', 'New York']);
    // Wed 01:00 UTC: Sydney 12:00 (AEDT), Tokyo 10:00.
    expect(fxCentresOpen(at('2026-10-21T01:00:00Z'))).toEqual(['Sydney', 'Tokyo']);
    // Wed 22:00 UTC: Sydney 09:00 Thursday; Tokyo, London and New York closed.
    expect(fxCentresOpen(at('2026-10-21T22:00:00Z'))).toEqual(['Sydney']);
    // The weekend: none, though Sydney's Monday morning has begun by Sunday 21:00 UTC.
    expect(fxCentresOpen(at('2026-10-24T15:00:00Z'))).toEqual([]);
  });
});

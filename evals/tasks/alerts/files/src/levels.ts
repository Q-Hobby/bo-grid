// Alert levels: alert when a symbol's last price reaches `above` or falls to
// `below`.
export const levels: Record<string, { above: number; below: number }> = {
  AAPL: { above: 110, below: 90 },
  MSFT: { above: 135, below: 115 },
  NVDA: { above: 160, below: 140 },
  TSLA: { above: 185, below: 165 },
  AMZN: { above: 210, below: 190 },
  META: { above: 235, below: 215 },
  GOOG: { above: 260, below: 240 },
  NFLX: { above: 285, below: 265 },
};

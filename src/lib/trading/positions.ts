// Positions from fills, on average cost: what a blotter's positions view
// shows. Each fill moves its symbol's position; a fill against it realizes
// P&L on the closed part at the average price, and one that goes through
// flat opens the rest on the other side at the fill price. Unrealized P&L is
// the position marked at a price you supply (`unrealizedPnl`), so a positions
// grid can keep the last price as a field of the row and compute it per row.
import { boError } from '../errors';

/** One execution. */
export interface PositionFill {
  symbol: string;
  side: 'buy' | 'sell';
  /** Shares or contracts, more than 0. */
  qty: number;
  price: number;
  /** Fees and commission, taken off realized P&L (a negative fee, a maker
      rebate, adds to it). */
  fee?: number;
}

/** A symbol's position after the fills so far. */
export interface Position {
  symbol: string;
  /** Long above 0, short below 0, flat at 0. */
  qty: number;
  /** Average price of the open position; 0 while flat. */
  avgPrice: number;
  /** P&L locked in by closing trades, after fees. */
  realized: number;
  /** Quantity bought and sold over the session. */
  bought: number;
  sold: number;
}

export interface PositionBook {
  /** Applies a fill and returns the symbol's position after it (a copy). */
  fill(f: PositionFill): Position;
  /** The symbol's position (a copy), or undefined before its first fill. */
  get(symbol: string): Position | undefined;
  /** Every position (copies), in the order their symbols first traded. */
  all(): Position[];
  clear(): void;
}

/** Quantities this close to flat, relative to the size traded, are flat:
    fractional sizes do not add up exactly (0.1 + 0.2 - 0.3 is 5.6e-17). */
const DUST = 1e-9;

/** A position book on average cost. Throws on a fill that is not one (an
    empty symbol, a side other than 'buy' or 'sell', a quantity that is not
    more than 0, a price or fee that is not a finite number), so a bad message
    from a feed is seen rather than booked. */
export function createPositions(): PositionBook {
  const book = new Map<string, Position>();
  return {
    fill(f) {
      if (typeof f.symbol !== 'string' || f.symbol === '') throw boError(TypeError, 'BG3001', `createPositions: a fill's symbol must be a non-empty string, got ${String(f.symbol)}.`, "Pass the instrument's symbol, e.g. { symbol: 'VNM', side: 'buy', qty: 100, price: 68.5 }.");
      if (f.side !== 'buy' && f.side !== 'sell') throw boError(TypeError, 'BG3002', `createPositions: a fill's side must be 'buy' or 'sell', got ${String(f.side)}.`, "Pass side: 'buy' or side: 'sell' (lower case).");
      if (!(f.qty > 0) || !Number.isFinite(f.qty)) throw boError(RangeError, 'BG3003', `createPositions: a fill's qty must be a number above 0, got ${f.qty}.`, "Pass the filled quantity as a positive number; the side says which way (side: 'sell', not a negative qty).");
      if (!Number.isFinite(f.price)) throw boError(RangeError, 'BG3004', `createPositions: a fill's price must be a finite number, got ${f.price}.`, 'Pass the fill price as a number, e.g. price: 68.5 (parse strings first).');
      if (f.fee !== undefined && !Number.isFinite(f.fee)) throw boError(RangeError, 'BG3005', `createPositions: a fill's fee must be a finite number, got ${f.fee}.`, 'Pass the fee as a number, e.g. fee: 1.2, or leave it out.');
      const p = book.get(f.symbol) ?? { symbol: f.symbol, qty: 0, avgPrice: 0, realized: 0, bought: 0, sold: 0 };
      const signed = f.side === 'buy' ? f.qty : -f.qty;
      if (f.side === 'buy') p.bought += f.qty;
      else p.sold += f.qty;
      const held = Math.abs(p.qty);
      const dust = DUST * Math.max(f.qty, held);
      if (held <= dust || Math.sign(p.qty) === Math.sign(signed)) {
        // Opening or adding: the average moves toward the fill price.
        if (held <= dust) {
          p.avgPrice = f.price;
          p.qty = signed;
        } else {
          p.avgPrice = (p.avgPrice * held + f.price * f.qty) / (held + f.qty);
          p.qty += signed;
        }
      } else {
        // Reducing: the closed part realizes against the average.
        const closed = Math.min(f.qty, held);
        p.realized += closed * (f.price - p.avgPrice) * Math.sign(p.qty);
        p.qty += signed;
        if (Math.abs(p.qty) <= dust) {
          p.qty = 0;
          p.avgPrice = 0;
        } else if (f.qty - closed > dust) p.avgPrice = f.price; // went through flat
      }
      p.realized -= f.fee ?? 0;
      book.set(f.symbol, p);
      return { ...p };
    },
    get(symbol) {
      const p = book.get(symbol);
      return p ? { ...p } : undefined;
    },
    all() {
      return [...book.values()].map((p) => ({ ...p }));
    },
    clear() {
      book.clear();
    },
  };
}

/** The open position marked at `price`: what it would make or lose if
    closed there. 0 while flat. */
export function unrealizedPnl(p: Pick<Position, 'qty' | 'avgPrice'>, price: number): number {
  return p.qty === 0 ? 0 : (price - p.avgPrice) * p.qty;
}

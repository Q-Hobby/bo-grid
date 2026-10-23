// Public types of `bo-grid/ladder`.
import type { GridRow } from '../grid/column';

/** The price step: one size, or a function of the price for a tick table
    (`(p) => vnTickSize(p, 'HOSE')`). It must be a positive number (at least
    1e-8); where it is not, the ladder shows no prices past that point. */
export type Tick = number | ((price: number) => number);

/** One resting level of the book: `[price, size]`. */
export type BookLevel = readonly [price: number, size: number];

/** One of your working orders, shown beside its side of the ladder. */
export interface LadderOrder {
  id: string | number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

/** What the user asked for on the ladder, with the price the row showed.
    The app places or cancels the order; the ladder only reports it. */
export type LadderAction =
  | {
      /** Buy (bid side, or B) or sell (ask side, or S) at `price`. */
      kind: 'buy' | 'sell';
      price: number;
      via: 'click' | 'key';
    }
  | {
      /** Cancel your `orders` at `price`: a click on your orders on one
          side, or Delete, which takes both sides (no `side`). */
      kind: 'cancel';
      price: number;
      side?: 'buy' | 'sell';
      orders: LadderOrder[];
      via: 'click' | 'key';
    };

/** Column headers, by column. */
export type LadderHeaders = Partial<Record<'myBid' | 'bid' | 'price' | 'ask' | 'myAsk', string>>;

/** A row of the ladder: one price level. */
export interface LadderRow extends GridRow {
  id: number;
  price: number;
  /** The price as shown. */
  text: string;
  /** Resting bid / ask size at this price, if any. */
  bid?: number;
  ask?: number;
  /** Size resting at this price and every better one on its side: bids from
      the best bid down, asks from the best ask up. */
  bidDepth?: number;
  askDepth?: number;
  /** Depth as a share (0–1) of the deepest row on screen, either side: the
      length of the depth bars. */
  bidShare?: number;
  askShare?: number;
  /** Your working orders at this price, summed per side. */
  myBid?: number;
  myAsk?: number;
  /** Where the row sits against the book. */
  zone: 'ask' | 'spread' | 'bid';
  bestBid: boolean;
  bestAsk: boolean;
  last: boolean;
}

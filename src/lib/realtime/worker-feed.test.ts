import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectFeed, serveFeed, type FeedScope, type FeedWorker, type WorkerFeed } from './worker-feed';

/** A worker and its scope in one thread: what the main thread posts to the
    worker arrives as a message event on the scope, ports included. */
function fakeWorker(): { worker: FeedWorker; scope: FeedScope } {
  const scope = new EventTarget();
  const worker: FeedWorker = {
    postMessage(data: unknown, transfer: Transferable[] = []) {
      scope.dispatchEvent(new MessageEvent('message', { data, ports: transfer as MessagePort[] }));
    },
  };
  return { worker, scope };
}

/** A frame scheduler run by hand. */
function frames() {
  let next: (() => void) | null = null;
  return {
    schedule: (fn: () => void) => {
      next = fn;
      return () => {
        if (next === fn) next = null;
      };
    },
    run: () => {
      const fn = next;
      next = null;
      fn?.();
    },
    get armed() {
      return next !== null;
    },
  };
}

/** Lets messages between the ports arrive. */
// Long enough for a round trip over a real MessagePort (a drain request to
// the worker, its batch back) on a busy CI runner; 5ms was not.
const delivered = (ms = 25) => new Promise((r) => setTimeout(r, ms));

type Patch = { px?: number; vol?: number };

const open: WorkerFeed[] = [];
const track = (f: WorkerFeed) => (open.push(f), f);
afterEach(() => {
  for (const f of open.splice(0)) f.close();
});

describe('serveFeed and connectFeed', () => {
  it('coalesces in the worker and applies one batch a frame on the main thread', async () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<string, Patch>({ scope });
    const f = frames();
    const batches: Array<Array<[string, Patch]>> = [];
    const feed = track(connectFeed<string, Patch>(worker, { apply: (b) => batches.push(b), schedule: f.schedule }));
    await delivered();
    expect(source.connected).toBe(true);
    expect(feed.connected).toBe(true);
    source.push('A', { px: 1 });
    source.push('A', { vol: 5 });
    source.push('B', { px: 2 });
    feed.start();
    f.run();
    await delivered();
    expect(batches).toEqual([
      [
        ['A', { px: 1, vol: 5 }],
        ['B', { px: 2 }],
      ],
    ]);
    expect(feed.applied).toBe(2);
    expect(feed.pending).toBe(0);
  });

  it('takes at most cap patches a frame and reports what is still waiting', async () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<number, Patch>({ scope });
    const f = frames();
    const sizes: number[] = [];
    const feed = track(connectFeed<number, Patch>(worker, { apply: (b) => sizes.push(b.length), schedule: f.schedule, cap: 3 }));
    await delivered();
    for (let i = 0; i < 7; i++) source.push(i, { px: i });
    feed.start();
    f.run();
    await delivered();
    expect(sizes).toEqual([3]);
    expect(feed.pending).toBe(4);
    f.run();
    await delivered();
    f.run();
    await delivered();
    expect(sizes).toEqual([3, 3, 1]);
    expect(feed.pending).toBe(0);
  });

  it('asks again only once the last batch has arrived, and never applies an empty one', async () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<string, Patch>({ scope });
    const f = frames();
    const apply = vi.fn();
    const feed = track(connectFeed<string, Patch>(worker, { apply, schedule: f.schedule }));
    await delivered();
    const asked = vi.spyOn(MessagePort.prototype, 'postMessage');
    feed.start();
    f.run();
    f.run(); // the first answer is not back yet: no second request
    expect(asked).toHaveBeenCalledTimes(1);
    asked.mockRestore();
    await delivered();
    expect(apply).not.toHaveBeenCalled();
    source.push('A', { px: 1 });
    f.run();
    await delivered();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('stops asking when stopped, and keeps what waits in the worker', async () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<string, Patch>({ scope });
    const f = frames();
    const apply = vi.fn();
    const feed = track(connectFeed<string, Patch>(worker, { apply, schedule: f.schedule }));
    await delivered();
    feed.start();
    expect(feed.running).toBe(true);
    feed.stop();
    expect(feed.running).toBe(false);
    expect(f.armed).toBe(false);
    source.push('A', { px: 1 });
    await delivered();
    expect(apply).not.toHaveBeenCalled();
    expect(source.pending).toBe(1);
    feed.start();
    f.run();
    await delivered();
    expect(apply).toHaveBeenCalledWith([['A', { px: 1 }]]);
  });

  it('passes a failing apply to onError, and the frames go on', async () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<string, Patch>({ scope });
    const f = frames();
    const onError = vi.fn();
    let fail = true;
    const feed = track(
      connectFeed<string, Patch>(worker, {
        apply: () => {
          if (fail) throw new Error('boom');
        },
        schedule: f.schedule,
        onError,
      }),
    );
    await delivered();
    source.push('A', { px: 1 });
    feed.start();
    f.run();
    await delivered();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    expect(feed.applied).toBe(0);
    fail = false;
    source.push('B', { px: 2 });
    f.run();
    await delivered();
    expect(feed.applied).toBe(1);
  });

  it('drops a patch that cannot be cloned, says so on both ends, and goes on', async () => {
    const { worker, scope } = fakeWorker();
    const workerErrors = vi.fn();
    const source = serveFeed<string, unknown>({ scope, onError: workerErrors });
    const f = frames();
    const onError = vi.fn();
    const got: unknown[] = [];
    const feed = track(connectFeed<string, unknown>(worker, { apply: (b) => got.push(...b), schedule: f.schedule, onError }));
    await delivered();
    source.push('A', { px: 1 });
    source.push('BAD', { fn: () => 1 });
    source.push('C', { px: 3 });
    feed.start();
    f.run();
    await delivered();
    expect(got).toEqual([
      ['A', { px: 1 }],
      ['C', { px: 3 }],
    ]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('1 patches could not be sent') }));
    expect(workerErrors).toHaveBeenCalledTimes(1);
    source.push('D', { px: 4 });
    f.run();
    await delivered();
    expect(got).toContainEqual(['D', { px: 4 }]);
  });

  it('connects to a serveFeed that starts late, as after an await in the worker', async () => {
    const { worker, scope } = fakeWorker();
    const f = frames();
    const got: unknown[] = [];
    const feed = track(connectFeed<string, Patch>(worker, { apply: (b) => got.push(...b), schedule: f.schedule }));
    await delivered(20);
    expect(feed.connected).toBe(false);
    const source = serveFeed<string, Patch>({ scope });
    await delivered(300);
    expect(feed.connected).toBe(true);
    source.push('A', { px: 1 });
    feed.start();
    f.run();
    await delivered();
    expect(got).toEqual([['A', { px: 1 }]]);
  });

  it('asks again when a connected worker stops answering, and says it stalled', async () => {
    const scope = new EventTarget();
    // A worker that takes the port and acknowledges it, then never answers.
    scope.addEventListener('message', (e) => {
      const m = e as MessageEvent;
      m.ports[0]?.postMessage({ ack: (m.data as { id: number }).id });
    });
    const asks: unknown[] = [];
    const worker: FeedWorker = {
      postMessage(data: unknown, transfer: Transferable[] = []) {
        const port = (transfer as MessagePort[])[0];
        scope.dispatchEvent(new MessageEvent('message', { data, ports: [port] }));
        port.addEventListener('message', (r) => asks.push((r as MessageEvent).data));
        port.start();
      },
    };
    const f = frames();
    const onError = vi.fn();
    const feed = track(connectFeed<string, Patch>(worker, { apply: () => {}, schedule: f.schedule, onError }));
    await delivered();
    feed.start();
    f.run();
    await delivered();
    expect(asks).toHaveLength(1);
    f.run();
    expect(feed.stalled).toBe(false);
    await delivered(1050);
    f.run();
    await delivered();
    expect(feed.stalled).toBe(true);
    expect(asks).toHaveLength(2);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('has not answered') }));
  });

  it('serves feeds by name, one each, and refuses a second of the same name', async () => {
    const { worker, scope } = fakeWorker();
    const quotes = serveFeed<string, Patch>({ scope, name: 'quotes' });
    const trades = serveFeed<string, Patch>({ scope, name: 'trades', merge: (a, b) => ({ vol: (a.vol ?? 0) + (b.vol ?? 0) }) });
    expect(() => serveFeed({ scope, name: 'quotes' })).toThrow(/already runs/);
    const f = frames();
    const q: unknown[] = [];
    const t: unknown[] = [];
    const qFeed = track(connectFeed<string, Patch>(worker, { name: 'quotes', apply: (b) => q.push(...b), schedule: f.schedule }));
    const g = frames();
    const tFeed = track(connectFeed<string, Patch>(worker, { name: 'trades', apply: (b) => t.push(...b), schedule: g.schedule }));
    await delivered();
    quotes.push('A', { px: 1 });
    trades.push('A', { vol: 2 });
    trades.push('A', { vol: 3 });
    qFeed.start();
    tFeed.start();
    f.run();
    g.run();
    await delivered();
    expect(q).toEqual([['A', { px: 1 }]]);
    expect(t).toEqual([['A', { vol: 5 }]]);
  });

  it('ignores messages on the worker that are not its own', () => {
    const { worker, scope } = fakeWorker();
    const source = serveFeed<string, Patch>({ scope });
    worker.postMessage({ kind: 'app-message' }, []);
    worker.postMessage('hello', []);
    expect(source.connected).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { BattleResolveError, parseResolveRequest } from './battle-request';

/**
 * This is the boundary where a request body from the browser becomes a typed instruction the
 * server acts on, so the cases that matter are the malformed ones — anything that slips through
 * here reaches battle resolution, which writes credits, XP and progress.
 */
describe('parseResolveRequest', () => {
  it('accepts the two valid modes', () => {
    expect(parseResolveRequest({ mode: 'advance' }).mode).toBe('advance');
    expect(parseResolveRequest({ mode: 'repeat' }).mode).toBe('repeat');
  });

  it('rejects a missing or unknown mode', () => {
    for (const body of [{}, { mode: 'ADVANCE' }, { mode: 'skip' }, { mode: 1 }, { mode: null }]) {
      expect(() => parseResolveRequest(body as Record<string, unknown>)).toThrow(BattleResolveError);
    }
  });

  it('defaults retreatOnLoss to false for anything that is not exactly true', () => {
    // The flag only ever makes a run harder, so a malformed value defaulting to "off" is the
    // safe direction — it can never hand the player something they did not earn.
    expect(parseResolveRequest({ mode: 'advance' }).retreatOnLoss).toBe(false);
    expect(parseResolveRequest({ mode: 'advance', retreatOnLoss: 'true' }).retreatOnLoss).toBe(false);
    expect(parseResolveRequest({ mode: 'advance', retreatOnLoss: 1 }).retreatOnLoss).toBe(false);
    expect(parseResolveRequest({ mode: 'advance', retreatOnLoss: true }).retreatOnLoss).toBe(true);
  });

  it('omits position when it is not supplied', () => {
    expect(parseResolveRequest({ mode: 'advance' }).position).toBeUndefined();
  });

  it('accepts a well-formed position', () => {
    expect(parseResolveRequest({ mode: 'advance', position: { fase: 3, estagio: 4 } }).position).toEqual({ fase: 3, estagio: 4 });
  });

  it('rejects positions that are not a pair of positive integers', () => {
    const bad = [
      { fase: 0, estagio: 1 }, // estágios/fases are 1-based
      { fase: 1, estagio: 0 },
      { fase: -2, estagio: 1 },
      { fase: 1.5, estagio: 1 }, // fractional would sail past an integer-only comparison
      { fase: 1 }, // missing half the pair
      { estagio: 1 },
      { fase: '1', estagio: '1' }, // strings compare unpredictably against numbers
      { fase: NaN, estagio: 1 },
      { fase: Infinity, estagio: 1 },
      [],
      'boss',
      42,
      null,
    ];
    for (const position of bad) {
      expect(() => parseResolveRequest({ mode: 'advance', position } as Record<string, unknown>), JSON.stringify(position)).toThrow(
        BattleResolveError,
      );
    }
  });

  it('reports a 400 rather than an unhandled error, so the route answers cleanly', () => {
    try {
      parseResolveRequest({ mode: 'nope' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BattleResolveError);
      expect((err as BattleResolveError).status).toBe(400);
    }
  });
});

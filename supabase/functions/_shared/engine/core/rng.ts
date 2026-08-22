// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
/** Minimal RNG surface the engine depends on — lets tests inject deterministic fakes. */
export interface RngLike {
  next(): number;
  chance(probability: number): boolean;
  pick<T>(items: T[]): T;
}

/** Deterministic PRNG (mulberry32) so a battle can be reproduced from a seed. */
export class Rng implements RngLike {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** True with the given probability in [0, 1]. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Picks a uniformly random element from a non-empty array. */
  pick<T>(items: T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  /** The mulberry32 state, for serializing a battle mid-simulation (e.g. across a server round-trip) and resuming it exactly via fromState. */
  getState(): number {
    return this.state;
  }

  /** Resumes an Rng from a state previously read via getState — next()'s sequence continues exactly where it left off. */
  static fromState(state: number): Rng {
    const rng = new Rng(0);
    rng.state = state | 0;
    return rng;
  }
}

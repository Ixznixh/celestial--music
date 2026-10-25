import { describe, it, expect } from 'vitest';
import {
  ANCHOR_SHELVES,
  ROTATING_SHELVES,
  ROTATING_SHELVES_PER_BUILD,
  MAX_PERSONALIZED_SHELVES,
  buildPersonalizedShelves,
  pickRotatingShelves,
  sanitizeSeeds,
  selectShelvesForFeed,
} from '../youtubeMusic';

describe('sanitizeSeeds', () => {
  it('trims, deduplicates case-insensitively and caps the list', () => {
    const seeds = sanitizeSeeds([
      '  Sid Sriram  ',
      '',
      '   ',
      'sid sriram',
      'A.R. Rahman',
      'Yuvan',
      'Ilaiyaraaja',
      'SPB',
      'Harris Jayaraj',
      'Anirudh',
      'Dropped Because Over Limit',
    ]);

    expect(seeds).toHaveLength(6);
    expect(seeds[0]).toBe('Sid Sriram');
    expect(seeds.filter((s) => s.toLowerCase() === 'sid sriram')).toHaveLength(1);
  });

  it('bounds each seed so nothing long reaches a provider query', () => {
    const [seed] = sanitizeSeeds(['x'.repeat(500)]);

    expect(seed).toHaveLength(60);
  });

  it('ignores non-string entries and missing input', () => {
    expect(sanitizeSeeds(undefined)).toEqual([]);
    expect(sanitizeSeeds([42 as unknown as string, null as unknown as string])).toEqual([]);
  });
});

describe('pickRotatingShelves', () => {
  it('returns the requested number of pool members', () => {
    const picked = pickRotatingShelves(ROTATING_SHELVES, ROTATING_SHELVES_PER_BUILD, Math.random);

    expect(picked).toHaveLength(ROTATING_SHELVES_PER_BUILD);
    expect(picked.every((shelf) => ROTATING_SHELVES.includes(shelf))).toBe(true);
  });

  it('is reproducible for a given random source', () => {
    const first = pickRotatingShelves(ROTATING_SHELVES, 4, () => 0.25);
    const second = pickRotatingShelves(ROTATING_SHELVES, 4, () => 0.25);

    expect(first.map((s) => s.id)).toEqual(second.map((s) => s.id));
  });

  it('returns the whole pool when it is smaller than the request', () => {
    const pool = ROTATING_SHELVES.slice(0, 2);
    expect(pickRotatingShelves(pool, 5, Math.random)).toHaveLength(2);
  });
});

describe('selectShelvesForFeed', () => {
  it('keeps the anchors, adds rotation and never repeats an id', () => {
    const shelves = selectShelvesForFeed([], Math.random);
    const ids = shelves.map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const anchor of ANCHOR_SHELVES) {
      expect(ids).toContain(anchor.id);
    }
    // 2 anchors + rotation, no taste shelves without seeds.
    expect(shelves).toHaveLength(ANCHOR_SHELVES.length + ROTATING_SHELVES_PER_BUILD);
  });

  it('leads with the taste shelves when seeds are present', () => {
    const shelves = selectShelvesForFeed(['Sid Sriram', 'A.R. Rahman'], Math.random);
    const ids = shelves.map((s) => s.id);

    expect(ids.slice(0, 2)).toEqual(['made-for-you', 'because-you-listened']);
    expect(shelves).toHaveLength(2 + ANCHOR_SHELVES.length + ROTATING_SHELVES_PER_BUILD);
    expect(shelves[0].query).toContain('Sid Sriram');
  });

  it('rotates to a different set for a different random source', () => {
    const a = selectShelvesForFeed([], () => 0.1).map((s) => s.id);
    const b = selectShelvesForFeed([], () => 0.9).map((s) => s.id);

    expect(a).not.toEqual(b);
    expect(a.slice().sort()).not.toEqual(b.slice().sort());
  });
});

describe('buildPersonalizedShelves', () => {
  it('builds nothing without seeds', () => {
    expect(buildPersonalizedShelves([])).toEqual([]);
  });

  it('builds one shelf for a single seed and never claims a second source', () => {
    const shelves = buildPersonalizedShelves(['Sid Sriram']);

    expect(shelves).toHaveLength(1);
    expect(shelves[0].id).toBe('made-for-you');
    expect(shelves[0].query).toBe('Sid Sriram top songs');
    expect(shelves[0].title).toBe('Made For You');
  });

  it('adds a "because you listened to" shelf only when a second seed exists', () => {
    const shelves = buildPersonalizedShelves(['Sid Sriram', 'Yuvan Shankar Raja']);

    expect(shelves).toHaveLength(2);
    expect(shelves[1].title).toBe('Because you listened to Yuvan Shankar Raja');
    expect(shelves).toHaveLength(Math.min(2, MAX_PERSONALIZED_SHELVES));
  });
});
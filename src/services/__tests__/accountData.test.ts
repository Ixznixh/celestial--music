import { describe, it, expect } from 'vitest';
import { Song } from '../../types';
import {
  GUEST_SCOPE,
  mergeById,
  mergePlayStats,
  scopeDbName,
  scopeForUid,
  toSyncSong,
  trimRecents,
  uidForScope,
} from '../accountData';

function makeSong(overrides: Partial<Song> & Pick<Song, 'id' | 'title'>): Song {
  return {
    artist: 'Anirudh Ravichander',
    artistId: 'artist-1',
    album: 'Master',
    albumId: 'album-1',
    duration: 200,
    streamUrl: '/api/song/x/audio',
    artworkUrl: 'https://example.com/art.jpg',
    ...overrides,
  } as Song;
}

describe('Account scope', () => {
  it('resolves missing identities to the guest scope', () => {
    expect(scopeForUid(null)).toBe(GUEST_SCOPE);
    expect(scopeForUid(undefined)).toBe(GUEST_SCOPE);
    expect(scopeForUid('')).toBe(GUEST_SCOPE);
    expect(scopeForUid('   ')).toBe(GUEST_SCOPE);
    expect(scopeForUid('abc123')).toBe('u_abc123');
  });

  it('round-trips through uidForScope', () => {
    expect(uidForScope(scopeForUid('uid-1'))).toBe('uid-1');
    expect(uidForScope(GUEST_SCOPE)).toBeNull();
    expect(uidForScope('unrelated')).toBeNull();
  });

  it('keeps the legacy database name for guest so existing data survives', () => {
    expect(scopeDbName(GUEST_SCOPE)).toBe('CelestialMusicDB');
    expect(scopeDbName('')).toBe('CelestialMusicDB');
  });

  it('gives every account its own database', () => {
    const a = scopeDbName(scopeForUid('user-a'));
    const b = scopeDbName(scopeForUid('user-b'));
    expect(a).not.toBe(b);
    expect(a).toBe(`CelestialMusicDB__u_user-a`);
    expect(a).not.toBe('CelestialMusicDB');
  });

  it('produces a stable name for the same account', () => {
    expect(scopeDbName(scopeForUid('user-a'))).toBe(scopeDbName(scopeForUid('user-a')));
  });
});

describe('Sync song shaping', () => {
  it('drops lyrics so a 30-track document stays far below Firestore limits', () => {
    const song = makeSong({
      id: 's1',
      title: 'Senjitaley',
      lyrics: [{ time: 0, text: 'line', translation: 'trans' } as any],
    });
    const synced = toSyncSong(song);
    expect((synced as any).lyrics).toBeUndefined();
    expect(synced.id).toBe('s1');
    expect(synced.title).toBe('Senjitaley');
    expect(synced.artist).toBe('Anirudh Ravichander');
    expect(synced.duration).toBe(200);
    expect(synced.artworkUrl).toBe(song.artworkUrl);
  });

  it('never invents fields that were absent', () => {
    const synced = toSyncSong(makeSong({ id: 's2', title: 'Vaathi Coming' }));
    expect((synced as any).genre).toBeUndefined();
    expect((synced as any).year).toBeUndefined();
  });
});

describe('Merging two accounts copies', () => {
  it('keeps local entries first and appends cloud-only ones', () => {
    const local = [makeSong({ id: 'a', title: 'A' }), makeSong({ id: 'b', title: 'B' })];
    const remote = [makeSong({ id: 'b', title: 'B' }), makeSong({ id: 'c', title: 'C' })];
    expect(mergeById(local, remote).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores malformed entries instead of corrupting the library', () => {
    const merged = mergeById(
      [makeSong({ id: 'a', title: 'A' })],
      [null as any, { title: 'no id' } as any, makeSong({ id: 'd', title: 'D' })]
    );
    expect(merged.map((s) => s.id)).toEqual(['a', 'd']);
  });

  it('survives empty inputs', () => {
    expect(mergeById([], [])).toEqual([]);
    expect(mergeById(undefined as any, [makeSong({ id: 'a', title: 'A' })])).toHaveLength(1);
  });
});

describe('Recent history', () => {
  it('orders newest first and caps the list', () => {
    const entries = [
      { playedAt: 100, id: 'old' },
      { playedAt: 900, id: 'newest' },
      { playedAt: 500, id: 'middle' },
      { playedAt: 700, id: 'recent' },
    ];
    expect(trimRecents(entries, 3).map((e) => e.id)).toEqual(['newest', 'recent', 'middle']);
  });

  it('treats a missing timestamp as oldest rather than dropping the play', () => {
    const entries = [{ id: 'untimed' }, { playedAt: 42, id: 'timed' }];
    expect(trimRecents(entries, 10).map((e) => e.id)).toEqual(['timed', 'untimed']);
  });
});

describe('Play ledgers', () => {
  it('keeps the higher count and the newest timestamp for each song', () => {
    const merged = mergePlayStats(
      { 'song-a': { count: 3, lastPlayedAt: 100, artist: 'Anirudh' } },
      { 'song-a': { count: 5, lastPlayedAt: 400 }, 'song-b': { count: 1, lastPlayedAt: 50 } }
    );
    expect(merged['song-a'].count).toBe(5);
    expect(merged['song-a'].lastPlayedAt).toBe(400);
    expect(merged['song-a'].artist).toBe('Anirudh');
    expect(merged['song-b'].count).toBe(1);
  });

  it('never lowers a count when the cloud copy is behind', () => {
    const merged = mergePlayStats(
      { 'song-a': { count: 9, lastPlayedAt: 500 } },
      { 'song-a': { count: 2, lastPlayedAt: 100 } }
    );
    expect(merged['song-a'].count).toBe(9);
    expect(merged['song-a'].lastPlayedAt).toBe(500);
  });

  it('handles null ledgers from a brand-new account', () => {
    expect(mergePlayStats(null, null)).toEqual({});
    expect(Object.keys(mergePlayStats(null, { x: { count: 1 } }))).toEqual(['x']);
  });
});

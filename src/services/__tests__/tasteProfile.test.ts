import { describe, it, expect } from 'vitest';
import { Song } from '../../types';
import {
  deriveTasteProfile,
  emptyTasteProfile,
  normalizeSongKey,
  rankSongs,
  songScore,
  withoutRecentlyPlayed,
  dedupeSongs,
  PlayStats,
} from '../tasteProfile';

function makeSong(overrides: Partial<Song> & Pick<Song, 'id' | 'title'>): Song {
  return {
    artist: 'Anirudh Ravichander',
    artistId: 'artist-1',
    album: 'Album',
    albumId: 'album-1',
    duration: 200,
    streamUrl: 'https://example.test/audio.m4a',
    artworkUrl: 'https://example.test/art.jpg',
    ...overrides,
  };
}

describe('deriveTasteProfile', () => {
  it('builds seeds from real history only and reports no signal when empty', () => {
    const empty = deriveTasteProfile({ recent: [], favorites: [], playStats: {} });

    expect(empty.hasSignal).toBe(false);
    expect(empty.seedArtists).toEqual([]);
    expect(empty.topArtists).toEqual([]);
    expect(empty.topGenres).toEqual([]);
  });

  it('weights the most recent and most favourited artists highest', () => {
    const profile = deriveTasteProfile({
      recent: [
        makeSong({ id: '1', title: 'A', artist: 'Sid Sriram' }),
        makeSong({ id: '2', title: 'B', artist: 'Sid Sriram' }),
        makeSong({ id: '3', title: 'C', artist: 'Pradeep Kumar' }),
      ],
      favorites: [makeSong({ id: '4', title: 'D', artist: 'A.R. Rahman' })],
      playStats: {},
    });

    expect(profile.hasSignal).toBe(true);
    expect(profile.topArtists[0].name).toBe('Sid Sriram');
    expect(profile.topArtists[0].weight).toBeCloseTo(1, 5);
    // The favourite is a deliberate signal and must appear in the seeds.
    expect(profile.seedArtists).toContain('A.R. Rahman');
    expect(profile.seedArtists.length).toBeLessThanOrEqual(4);
  });

  it('folds repeat plays from the ledger into artist weights', () => {
    const stats: PlayStats = {
      'song a:::sid sriram': {
        count: 7,
        artist: 'Sid Sriram',
        title: 'Song A',
        lastPlayedAt: 1,
      },
      'song b:::yuvan shankar raja': {
        count: 3,
        artist: 'Yuvan Shankar Raja',
        title: 'Song B',
        lastPlayedAt: 2,
      },
    };

    const profile = deriveTasteProfile({ recent: [], favorites: [], playStats: stats });

    expect(profile.seedArtists[0]).toBe('Sid Sriram');
    expect(profile.topArtists.map((a) => a.name)).toEqual(['Sid Sriram', 'Yuvan Shankar Raja']);
  });

  it('never invents an artist or genre name', () => {
    const profile = deriveTasteProfile({
      recent: [makeSong({ id: '1', title: 'A', artist: '  ' })],
      favorites: [],
      playStats: {},
    });

    expect(profile.seedArtists).toEqual([]);
    expect(profile.topArtists).toEqual([]);
    expect(profile.topGenres).toEqual([]);
  });

  it('records recent and favourite identities for filtering', () => {
    const song = makeSong({ id: 'x1', title: 'Katru Veliyudai', artist: 'Sid Sriram' });
    const profile = deriveTasteProfile({ recent: [song], favorites: [song], playStats: {} });

    expect(profile.recentKeys).toEqual([normalizeSongKey(song)]);
    expect(profile.recentIds).toEqual(['x1']);
    expect(profile.favoriteIds).toEqual(['x1']);
  });
});

describe('songScore and rankSongs', () => {
  const profile = deriveTasteProfile({
    recent: [makeSong({ id: 'r1', title: 'Recent', artist: 'Sid Sriram' })],
    favorites: [makeSong({ id: 'f1', title: 'Fav', artist: 'A.R. Rahman' })],
    playStats: {},
  });

  it('scores favourites and taste matches above unrelated songs', () => {
    const favorite = makeSong({ id: 'f1', title: 'Fav', artist: 'A.R. Rahman' });
    const tasteMatch = makeSong({ id: 'm1', title: 'Match', artist: 'Sid Sriram' });
    const unrelated = makeSong({ id: 'u1', title: 'Other', artist: 'Someone Else' });

    expect(songScore(favorite, profile)).toBeGreaterThan(songScore(tasteMatch, profile));
    expect(songScore(tasteMatch, profile)).toBeGreaterThan(songScore(unrelated, profile));
    expect(songScore(unrelated, profile)).toBe(0);
  });

  it('ranks by score but keeps songs that fit nothing — never hides them', () => {
    const songs = [
      makeSong({ id: 'u1', title: 'Other', artist: 'Someone Else' }),
      makeSong({ id: 'm1', title: 'Match', artist: 'Sid Sriram' }),
      makeSong({ id: 'f1', title: 'Fav', artist: 'A.R. Rahman' }),
    ];

    const ranked = rankSongs(songs, profile);

    expect(ranked).toHaveLength(3);
    expect(ranked.map((s) => s.id)).toEqual(['f1', 'm1', 'u1']);
  });

  it('is stable for equal scores', () => {
    const songs = [
      makeSong({ id: 'a', title: 'A', artist: 'Nobody One' }),
      makeSong({ id: 'b', title: 'B', artist: 'Nobody Two' }),
      makeSong({ id: 'c', title: 'C', artist: 'Nobody Three' }),
    ];

    expect(rankSongs(songs, profile).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('withoutRecentlyPlayed', () => {
  it('drops recently played songs by key and by id, keeps the rest', () => {
    const recent = makeSong({ id: 'r1', title: 'Fresh', artist: 'Sid Sriram' });
    const profile = deriveTasteProfile({ recent: [recent], favorites: [], playStats: {} });

    const sameSongDifferentId = makeSong({ id: 'other-id', title: 'Fresh', artist: 'Sid Sriram' });
    const other = makeSong({ id: 'o1', title: 'Untouched', artist: 'Someone Else' });

    const kept = withoutRecentlyPlayed([recent, sameSongDifferentId, other], profile);

    expect(kept.map((s) => s.id)).toEqual(['o1']);
  });

  it('returns everything when there is no history', () => {
    const songs = [makeSong({ id: 'a', title: 'A' }), makeSong({ id: 'b', title: 'B' })];
    expect(withoutRecentlyPlayed(songs, emptyTasteProfile())).toHaveLength(2);
  });
});

describe('dedupeSongs', () => {
  it('keeps the first occurrence across title+artist and id', () => {
    const first = makeSong({ id: '1', title: 'Same Song', artist: 'Artist' });
    const byTitle = makeSong({ id: '2', title: 'Same Song', artist: 'Artist' });
    const byId = makeSong({ id: '1', title: 'Renamed', artist: 'Artist' });
    const unique = makeSong({ id: '3', title: 'Other', artist: 'Artist' });

    const result = dedupeSongs([first, byTitle, byId, unique], new Set());

    expect(result.map((s) => s.id)).toEqual(['1', '3']);
  });
});
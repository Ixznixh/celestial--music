import { describe, it, expect } from 'vitest';
import { HomeSection, Song } from '../../types';
import { composeHomeFeed, buildTopPlayed, buildJumpBackIn, TOP_PLAYED_ID, JUMP_BACK_IN_ID, isSongEntry } from '../homeFeed';
import { deriveTasteProfile, emptyTasteProfile, TasteProfile } from '../tasteProfile';

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

function makeSection(id: string, songs: Song[], type: HomeSection['type'] = 'song'): HomeSection {
  return { id, title: id, subtitle: 'sub', type, items: songs };
}

function songs(count: number, prefix: string): Song[] {
  return Array.from({ length: count }, (_, i) =>
    makeSong({ id: `${prefix}-${i}`, title: `${prefix} ${i}`, artist: `Artist ${i % 3}` })
  );
}

describe('composeHomeFeed', () => {
  it('orders hero, history, taste shelves, then the rest', () => {
    const sections = [
      makeSection('trending-tamil', songs(4, 'trend')),
      makeSection('quick-picks', songs(4, 'qp')),
      makeSection('made-for-you', songs(4, 'mfy')),
      makeSection('kuthu-party', songs(4, 'kuthu')),
    ];

    const composed = composeHomeFeed({ sections, profile: emptyTasteProfile(), recent: [] });

    expect(composed.map((s) => s.id)).toEqual([
      'quick-picks',
      'made-for-you',
      'trending-tamil',
      'kuthu-party',
    ]);
  });

  it('includes "Top Played" shelf when there is history', () => {
    const recent = songs(5, 'recent');
    const sections = [makeSection('quick-picks', songs(4, 'qp'))];

    const composed = composeHomeFeed({ sections, profile: emptyTasteProfile(), recent });

    expect(composed[0].id).toBe('quick-picks');
    expect(composed[1].id).toBe(TOP_PLAYED_ID);
    expect(composed[1].title).toBe('Top Played');
    expect(composed[1].subtitle).toBe('Your most played tracks on this device');
  });

  it('ranks Top Played shelf songs by play count descending', () => {
    const songA = makeSong({ id: 's-a', title: 'Song A', artist: 'Artist 1' });
    const songB = makeSong({ id: 's-b', title: 'Song B', artist: 'Artist 2' });
    const songC = makeSong({ id: 's-c', title: 'Song C', artist: 'Artist 3' });
    const recent = [songA, songB, songC];
    const playStats = {
      'song b:::artist 2': { count: 15, lastPlayedAt: 100 },
      'song a:::artist 1': { count: 3, lastPlayedAt: 200 },
      'song c:::artist 3': { count: 8, lastPlayedAt: 150 },
    };

    const composed = composeHomeFeed({
      sections: [makeSection('quick-picks', songs(4, 'qp'))],
      profile: emptyTasteProfile(),
      recent,
      playStats,
    });

    const topSection = composed.find((s) => s.id === TOP_PLAYED_ID);
    expect(topSection).toBeDefined();
    expect(topSection?.items.map((s: Song) => s.id)).toEqual(['s-b', 's-c', 's-a']);
  });

  it('keeps recently played songs out of other shelves when filtered', () => {
    const recent = [makeSong({ id: 'r1', title: 'Just Played', artist: 'Sid Sriram' })];
    const profile = deriveTasteProfile({ recent, favorites: [], playStats: {} });

    const shelfSongs = [makeSong({ id: 'r1', title: 'Just Played', artist: 'Sid Sriram' }), ...songs(3, 'x')];
    const sections = [makeSection('quick-picks', shelfSongs), makeSection('anchor', shelfSongs)];

    const composed = composeHomeFeed({ sections, profile, recent });

    for (const section of composed) {
      if (section.id === TOP_PLAYED_ID) continue;
      const titles = section.items.map((item: Song) => item.title);
      expect(titles).not.toContain('Just Played');
    }
  });

  it('never repeats a song across shelves — first shelf wins', () => {
    const shared = makeSong({ id: 'shared', title: 'Shared Song', artist: 'Shared Artist' });
    const sections = [
      makeSection('quick-picks', [shared, ...songs(3, 'qp')]),
      makeSection('anchor', [shared, ...songs(4, 'anchor')]),
    ];

    const composed = composeHomeFeed({ sections, profile: emptyTasteProfile(), recent: [] });
    const occurrences = composed
      .flatMap((section) => section.items)
      .filter((item) => (item as Song).id === 'shared');

    expect(occurrences).toHaveLength(1);
    expect(composed[1].items).toHaveLength(4);
  });

  it('drops shelves that are too thin but keeps the hero', () => {
    const sections = [
      makeSection('quick-picks', songs(1, 'qp')),
      makeSection('thin', songs(2, 'thin')),
      makeSection('full', songs(4, 'full')),
    ];

    const composed = composeHomeFeed({ sections, profile: emptyTasteProfile(), recent: [] });

    expect(composed.map((s) => s.id)).toEqual(['quick-picks', 'full']);
  });

  it('ranks taste-seeded shelves by fit while keeping every song', () => {
    const favorite = makeSong({ id: 'f1', title: 'Favourite', artist: 'A.R. Rahman' });
    const unrelated = makeSong({ id: 'u1', title: 'Unrelated', artist: 'Nobody' });
    const profile = deriveTasteProfile({
      recent: [],
      favorites: [favorite],
      playStats: {},
    });

    const sections = [makeSection('made-for-you', [unrelated, favorite, ...songs(2, 'x')])];
    const composed = composeHomeFeed({ sections, profile, recent: [] });

    // The favourite leads; everything else keeps its provider order (stable ties).
    expect(composed[0].items.map((item: Song) => item.id)).toEqual(['f1', 'u1', 'x-0', 'x-1']);
    expect(composed[0].items).toHaveLength(4);
  });

  it('returns nothing for an empty feed', () => {
    expect(composeHomeFeed({ sections: [], profile: emptyTasteProfile(), recent: [] })).toEqual([]);
  });
});

describe('buildTopPlayed', () => {
  it('returns null for empty recent history', () => {
    expect(buildTopPlayed([])).toBeNull();
  });

  it('deduplicates and ranks by play count', () => {
    const song1 = makeSong({ id: '1', title: 'Song 1', artist: 'Artist' });
    const song2 = makeSong({ id: '2', title: 'Song 2', artist: 'Artist' });
    const duplicate = makeSong({ id: 'dup', title: 'Song 1', artist: 'Artist' });

    const shelf = buildTopPlayed([song1, duplicate, song2], {
      'song 2:::artist': { count: 10, lastPlayedAt: 1 },
      'song 1:::artist': { count: 2, lastPlayedAt: 2 },
    });

    expect(shelf).not.toBeNull();
    expect(shelf?.id).toBe(TOP_PLAYED_ID);
    expect(shelf?.title).toBe('Top Played');
    expect(shelf?.subtitle).toBe('Your most played tracks on this device');
    expect(shelf?.items.map((s: Song) => s.id)).toEqual(['2', '1']);
  });
});

describe('isSongEntry', () => {
  it('accepts real songs and rejects albums, demo items, jukeboxes, and compilations', () => {
    expect(isSongEntry(makeSong({ id: '1', title: 'Real' }))).toBe(true);
    expect(isSongEntry(makeSong({ id: '2', title: 'Jukebox', duration: 2102 }))).toBe(false);
    expect(isSongEntry(makeSong({ id: '3', title: 'Audio Jukebox', duration: 200 }))).toBe(false);
    expect(isSongEntry(makeSong({ id: '4', title: 'Full Album Songs', duration: 200 }))).toBe(false);
    expect(isSongEntry(makeSong({ id: '5', title: 'Long Mix', duration: 3600 }))).toBe(false);
    expect(isSongEntry(makeSong({ id: '6', title: 'Short Snippet', duration: 15 }))).toBe(false);
    expect(
      isSongEntry({
        id: 'demo-1',
        title: 'Demo Track',
        artist: 'Velvet Horizon',
        artistId: 'a',
        album: 'Album',
        albumId: 'al',
        duration: 200,
        streamUrl: 'https://example.test/a.m4a',
        artworkUrl: 'https://example.test/a.jpg',
      })
    ).toBe(false);
  });
});
/**
 * homeFeed.ts
 *
 * Composes the home feed from provider shelves plus this device's listening history.
 *
 * Pure and side-effect free so the rules that decide what a listener sees are testable:
 * which shelves survive, what gets dropped as too thin, where recently played songs are
 * allowed, and in which order shelves appear. Nothing here fabricates content — every
 * item comes from the provider or from the local history the listener generated.
 */

import { Album, Artist, HomeSection, Playlist, Song } from '../types';
import { isDemoItem } from './indexedDB';
import {
  TasteProfile,
  PlayStats,
  normalizeSongKey,
  dedupeSongs,
  rankSongs,
  withoutRecentlyPlayed,
} from './tasteProfile';
import { isProperSongTrack } from '../utils/songFilter';

export const TOP_PLAYED_ID = 'top-played';
export const JUMP_BACK_IN_ID = 'jump-back-in';
export const QUICK_PICKS_ID = 'quick-picks';

/** Shelves the server built from the listener's own taste seeds. */
export const PERSONAL_SHELF_IDS = new Set(['made-for-you', 'because-you-listened']);

/** Below this a shelf looks abandoned rather than curated. */
const MIN_SHELF_SONGS = 3;
const TOP_PLAYED_LIMIT = 16;

export function isSongEntry(item: Song | Album | Playlist | Artist): item is Song {
  if (!item || isDemoItem(item)) return false;
  const candidate = item as Song;
  return (
    typeof candidate.duration === 'number' &&
    typeof candidate.streamUrl === 'string' &&
    Boolean(candidate.title) &&
    isProperSongTrack(candidate)
  );
}

function isQuickPicks(section: HomeSection): boolean {
  return section.id === QUICK_PICKS_ID || section.title.toLowerCase().includes('quick picks');
}

function isJumpBackIn(section: HomeSection): boolean {
  const t = (section.title || '').toLowerCase();
  const id = (section.id || '').toLowerCase();
  return id === JUMP_BACK_IN_ID || id.includes('jump_back') || id.includes('jump-back') || t.includes('jump back');
}

/**
 * Builds the "Top Played" shelf from the device's listening history and play stats.
 * Tracks are ranked primarily by play count, then by most recently played.
 */
export function buildTopPlayed(
  recent: Song[],
  playStats: PlayStats = {},
  limit = TOP_PLAYED_LIMIT
): HomeSection | null {
  if (!Array.isArray(recent) || recent.length === 0) return null;

  const valid = recent.filter(isSongEntry);
  if (valid.length === 0) return null;

  // Deduplicate by normalized song key (title + artist)
  const songMap = new Map<string, Song>();
  for (const song of valid) {
    const key = normalizeSongKey(song);
    if (!songMap.has(key)) {
      songMap.set(key, song);
    }
  }

  const uniqueSongs = Array.from(songMap.values());

  // Rank by play count descending, then recency (lastPlayedAt), keeping original order on ties
  const ranked = [...uniqueSongs].sort((a, b) => {
    const keyA = normalizeSongKey(a);
    const keyB = normalizeSongKey(b);
    const statA = playStats[keyA];
    const statB = playStats[keyB];
    const countA = statA?.count ?? 1;
    const countB = statB?.count ?? 1;
    if (countB !== countA) return countB - countA;
    const lastA = statA?.lastPlayedAt ?? 0;
    const lastB = statB?.lastPlayedAt ?? 0;
    if (lastB !== lastA) return lastB - lastA;
    return 0;
  });

  const items = ranked.slice(0, limit);
  if (items.length === 0) return null;

  return {
    id: TOP_PLAYED_ID,
    title: 'Top Played',
    subtitle: 'Your most played tracks on this device',
    type: 'song',
    items,
  };
}

/** Backward compatibility alias for previous Jump back in callers */
export function buildJumpBackIn(recent: Song[], playStats: PlayStats = {}): HomeSection | null {
  return buildTopPlayed(recent, playStats);
}

interface ComposeInput {
  sections: HomeSection[];
  profile: TasteProfile;
  recent: Song[];
  playStats?: PlayStats;
}

/**
 * Order of the finished feed: hero Quick Picks, then Top Played,
 * then taste-seeded shelves, then anchors and rotated shelves.
 */
export function composeHomeFeed({
  sections,
  profile,
  recent,
  playStats = {},
}: ComposeInput): HomeSection[] {
  const source = (Array.isArray(sections) ? sections : []).filter(
    (s) => !isJumpBackIn(s) && s.id !== TOP_PLAYED_ID
  );

  const topPlayed = buildTopPlayed(recent, playStats);
  const quickPicks = source.find(isQuickPicks);
  const personal = source.filter(
    (section) => !isQuickPicks(section) && PERSONAL_SHELF_IDS.has(section.id)
  );
  const rest = source.filter(
    (section) => section !== quickPicks && !PERSONAL_SHELF_IDS.has(section.id)
  );

  const ordered: HomeSection[] = [];
  if (quickPicks) ordered.push(quickPicks);
  if (topPlayed) ordered.push(topPlayed);
  ordered.push(...personal, ...rest);

  const seen = new Set<string>();
  const result: HomeSection[] = [];

  for (const section of ordered) {
    const isTopPlayed = section.id === TOP_PLAYED_ID || section.id === JUMP_BACK_IN_ID;
    const isPersonal = PERSONAL_SHELF_IDS.has(section.id);

    let items = section.items || [];

    if (section.type === 'song') {
      const songs = items.filter(isSongEntry);
      // Top played songs come from local history and must not be filtered out by withoutRecentlyPlayed
      const keptSongs = isTopPlayed ? songs : withoutRecentlyPlayed(songs, profile);
      const rankedSongs = isPersonal ? rankSongs(keptSongs, profile) : keptSongs;
      // Deduplicate songs across shelves
      items = dedupeSongs(rankedSongs, seen);
    } else {
      const ids = new Set<string>();
      items = items.filter((item) => {
        if (!item?.id || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      });
    }

    const count = section.type === 'song' ? items.filter(isSongEntry).length : items.length;
    const isHero = isQuickPicks(section) || isTopPlayed;
    if (count === 0) continue;
    if (!isHero && count < MIN_SHELF_SONGS) continue;

    result.push({ ...section, items });
  }

  return result;
}
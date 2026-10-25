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
  dedupeSongs,
  rankSongs,
  withoutRecentlyPlayed,
} from './tasteProfile';

export const JUMP_BACK_IN_ID = 'jump-back-in';
export const QUICK_PICKS_ID = 'quick-picks';

/** Shelves the server built from the listener's own taste seeds. */
export const PERSONAL_SHELF_IDS = new Set(['made-for-you', 'because-you-listened']);

/** Below this a shelf looks abandoned rather than curated. */
const MIN_SHELF_SONGS = 3;
const JUMP_BACK_IN_LIMIT = 12;

export function isSongEntry(item: Song | Album | Playlist | Artist): item is Song {
  if (!item || isDemoItem(item)) return false;
  const candidate = item as Song;
  return (
    typeof candidate.duration === 'number' &&
    typeof candidate.streamUrl === 'string' &&
    Boolean(candidate.title)
  );
}

function isQuickPicks(section: HomeSection): boolean {
  return section.id === QUICK_PICKS_ID || section.title.toLowerCase().includes('quick picks');
}

/** Recently played on this device — the one place they are allowed to reappear. */
export function buildJumpBackIn(recent: Song[]): HomeSection | null {
  const songs = (recent || []).filter(
    (song): song is Song => Boolean(song) && !isDemoItem(song) && Boolean(song.id) && Boolean(song.title)
  );
  if (songs.length === 0) return null;

  const unique = dedupeSongs(songs, new Set());
  return {
    id: JUMP_BACK_IN_ID,
    title: 'Jump back in',
    subtitle: 'Recently played on this device',
    type: 'song',
    items: unique.slice(0, JUMP_BACK_IN_LIMIT),
  };
}

interface ComposeInput {
  sections: HomeSection[];
  profile: TasteProfile;
  recent: Song[];
}

/**
 * Order of the finished feed: hero Quick Picks, then the listener's own history, then
 * taste-seeded shelves, then the anchors, then whatever rotated in this build.
 */
export function composeHomeFeed({ sections, profile, recent }: ComposeInput): HomeSection[] {
  const source = Array.isArray(sections) ? sections : [];

  const quickPicks = source.find(isQuickPicks);
  const personal = source.filter((section) => !isQuickPicks(section) && PERSONAL_SHELF_IDS.has(section.id));
  const rest = source.filter(
    (section) => section !== quickPicks && !PERSONAL_SHELF_IDS.has(section.id)
  );

  const ordered: HomeSection[] = [];
  if (quickPicks) ordered.push(quickPicks);
  const jumpBackIn = buildJumpBackIn(recent);
  if (jumpBackIn) ordered.push(jumpBackIn);
  ordered.push(...personal, ...rest);

  const seen = new Set<string>();
  const result: HomeSection[] = [];

  for (const section of ordered) {
    const isHistory = section.id === JUMP_BACK_IN_ID;
    const isPersonal = PERSONAL_SHELF_IDS.has(section.id);

    let items = section.items || [];

    if (section.type === 'song') {
      const songs = items.filter(isSongEntry);
      // Recently played songs live only in "Jump back in"; everywhere else they make a
      // refresh look unchanged, so they are filtered out rather than shuffled.
      const keptSongs = isHistory ? songs : withoutRecentlyPlayed(songs, profile);
      const rankedSongs = isPersonal ? rankSongs(keptSongs, profile) : keptSongs;
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
    const isHero = isQuickPicks(section) || isHistory;
    if (count === 0) continue;
    if (!isHero && count < MIN_SHELF_SONGS) continue;

    result.push({ ...section, items });
  }

  return result;
}
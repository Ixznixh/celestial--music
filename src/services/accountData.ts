/**
 * accountData.ts
 *
 * The rules that decide what belongs to which account, kept pure and side-effect free so
 * they can be tested without a browser, a database or a network.
 *
 * A listener is either "guest" (not signed in — this device keeps the library it already
 * had) or a signed-in uid. Every library store lives in a database named after that
 * scope, so two Google accounts on one phone never see each other's library, history or
 * taste profile, and signing out returns to the guest data that was here all along.
 */

import { Song } from '../types';

/** The scope used before anyone signs in, and after they sign out. */
export const GUEST_SCOPE = 'guest';

/** Scope for a signed-in uid; null/undefined/empty resolves to guest. */
export function scopeForUid(uid?: string | null): string {
  const clean = (uid || '').trim();
  return clean ? `u_${clean}` : GUEST_SCOPE;
}

/** The uid a scope belongs to, or null for guest. */
export function uidForScope(scope: string): string | null {
  return scope && scope !== GUEST_SCOPE && scope.startsWith('u_') ? scope.slice(2) : null;
}

/**
 * Database name for a scope. The guest scope keeps the original name so the library a
 * device already built before sign-in existed stays exactly where it was — it simply
 * becomes the guest profile instead of vanishing.
 */
export function scopeDbName(scope: string, baseName = 'CelestialMusicDB'): string {
  if (!scope || scope === GUEST_SCOPE) return baseName;
  // IndexedDB names are free-form, but keep them printable and stable.
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${baseName}__${safe}`;
}

/** Fields worth carrying between devices. Lyrics and other bulky blobs stay local. */
const SYNC_FIELDS = [
  'id',
  'title',
  'artist',
  'artists',
  'artistId',
  'album',
  'albumId',
  'duration',
  'streamUrl',
  'artwork',
  'artworkUrl',
  'dominantColor',
  'accentColor',
  'genre',
  'year',
  'trackNumber',
  'explicit',
  'provider',
  'providerUrl',
] as const;

/**
 * A song shaped for storage in the account document. Lyrics are dropped because a
 * document holds 30 recent tracks and must stay far below Firestore's 1 MB limit.
 */
export function toSyncSong(song: Song): Song {
  const source = song as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of SYNC_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out as unknown as Song;
}

/** Union of two lists by id: local order first, cloud-only entries appended. */
export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...(local || []), ...(remote || [])]) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Newest plays first, capped. Sorting here means the cloud copy and the local copy agree
 * on which 30 plays matter even if they were built in a different order.
 */
export function trimRecents<T extends { playedAt?: number }>(entries: T[], limit = 30): T[] {
  return [...(entries || [])]
    .filter(Boolean)
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, Math.max(0, limit));
}

export interface PlayStatLike {
  count?: number;
  lastPlayedAt?: number;
  artist?: string;
  genre?: string;
  title?: string;
}

/**
 * Two play ledgers combined: each song keeps the higher count, the newest timestamp and
 * whichever metadata it actually has. Neither side's listening is discarded.
 */
export function mergePlayStats(
  local: Record<string, PlayStatLike> | null | undefined,
  remote: Record<string, PlayStatLike> | null | undefined
): Record<string, PlayStatLike> {
  const out: Record<string, PlayStatLike> = {};
  for (const source of [local || {}, remote || {}]) {
    for (const [key, stat] of Object.entries(source)) {
      if (!key || !stat) continue;
      const existing = out[key];
      if (!existing) {
        out[key] = { ...stat };
        continue;
      }
      out[key] = {
        count: Math.max(existing.count || 0, stat.count || 0),
        lastPlayedAt: Math.max(existing.lastPlayedAt || 0, stat.lastPlayedAt || 0),
        artist: stat.artist || existing.artist,
        genre: stat.genre || existing.genre,
        title: stat.title || existing.title,
      };
    }
  }
  return out;
}

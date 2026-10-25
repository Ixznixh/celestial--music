/**
 * accountScope.ts
 *
 * Owns the answer to "whose library is open right now?".
 *
 * The player has exactly two kinds of scope: `guest` (not signed in — the device keeps
 * the library it already had) and `u_<uid>` for each Google account. Switching scope
 * swaps the entire IndexedDB the app reads from, so favourites, playlists, history, play
 * counts, taste seeds and settings belong to one account and never leak to another.
 *
 * On sign-in the account's cloud copy is pulled down into its own stores (merging, never
 * deleting, so a failed sync cannot erase work); while signed in the account's changes
 * are pushed back up. Every push is fire-and-forget: syncing must never block a play.
 */

import {
  auth,
  subscribeToAuth,
  fetchUserFavoritesFromFirestore,
  fetchUserPlaylistsFromFirestore,
  fetchListeningDataFromFirestore,
  syncListeningDataToFirestore,
  ListeningSnapshot,
} from '../lib/firebase';
import { db } from './indexedDB';
import { PLAY_STATS_KEY, getPlayStats } from './tasteProfile';
import { GUEST_SCOPE, mergePlayStats, scopeForUid, uidForScope, trimRecents } from './accountData';
import { Song, Playlist } from '../types';

let currentScope = GUEST_SCOPE;
const listeners = new Set<(scope: string) => void>();
let readyPromise: Promise<string> | null = null;
let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** How long a play waits before its account copy is updated. */
const LISTENING_SYNC_DELAY_MS = 15_000;

export function getAccountScope(): string {
  return currentScope;
}

/** Fires after the database has already switched, so listeners may read the new scope. */
export function onAccountScopeChange(fn: (scope: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(scope: string): void {
  for (const fn of [...listeners]) {
    try {
      fn(scope);
    } catch (err) {
      console.warn('Account scope listener failed:', err);
    }
  }
}

/**
 * Merges the account's cloud copy into whichever stores are open for it. Local entries
 * always survive: pulling history back must never remove something this device knows.
 */
async function pullAccountData(uid: string): Promise<void> {
  // Annotated promises keep Promise.all honest: without them the tuple element types
  // widen and the merge below would be untyped.
  const favoritesPromise: Promise<Song[]> = fetchUserFavoritesFromFirestore(uid).catch(
    () => [] as Song[]
  );
  const playlistsPromise: Promise<Playlist[]> = fetchUserPlaylistsFromFirestore(uid).catch(
    () => [] as Playlist[]
  );
  const listeningPromise: Promise<ListeningSnapshot | null> =
    fetchListeningDataFromFirestore(uid).catch(() => null);

  const [remoteFavorites, remotePlaylists, listening] = await Promise.all([
    favoritesPromise,
    playlistsPromise,
    listeningPromise,
  ]);

  const localFavorites = await db.getFavorites();
  const favoriteIds = new Set(localFavorites.map((song) => song.id));
  for (const song of remoteFavorites) {
    if (song && song.id && !favoriteIds.has(song.id)) {
      favoriteIds.add(song.id);
      await db.addFavorite(song);
    }
  }

  const localPlaylists = await db.getPlaylists();
  const playlistIds = new Set(localPlaylists.map((playlist) => playlist.id));
  for (const playlist of remotePlaylists) {
    if (playlist && playlist.id && !playlistIds.has(playlist.id)) {
      playlistIds.add(playlist.id);
      await db.savePlaylist(playlist);
    }
  }

  if (listening) {
    const localRecents = await db.getRecentEntries(100);
    const recentIds = new Set(localRecents.map((song) => song.id));
    const missing = trimRecents(listening.recents || [], 30).filter(
      (song) => song && song.id && !recentIds.has(song.id)
    );
    if (missing.length > 0) {
      await db.importRecentEntries(missing);
    }

    if (listening.playStats) {
      const merged = mergePlayStats(await getPlayStats(), listening.playStats);
      if (Object.keys(merged).length > 0) {
        await db.saveSetting(PLAY_STATS_KEY, merged);
      }
    }
  }
}

/**
 * Uploads this account's recent plays and play counts. Skips silently when the stores
 * open do not belong to that account — a switch in flight is not a reason to fail.
 */
export async function pushListeningData(explicitUid?: string | null): Promise<void> {
  const uid = explicitUid !== undefined ? explicitUid : auth.currentUser?.uid || null;
  if (!uid || db.getScope() !== scopeForUid(uid)) return;

  try {
    const [recents, playStats] = await Promise.all([db.getRecentEntries(30), getPlayStats()]);
    if (recents.length === 0 && Object.keys(playStats || {}).length === 0) return;
    await syncListeningDataToFirestore(uid, recents, playStats as Record<string, any>);
  } catch (err) {
    console.warn('Listening sync skipped:', err);
  }
}

/**
 * Called on every real play. Throttled to one upload per window so a long listening
 * session costs a handful of writes instead of one per track.
 */
export function scheduleListeningSync(delayMs: number = LISTENING_SYNC_DELAY_MS): void {
  if (typeof window === 'undefined' || !auth.currentUser) return;
  if (pendingSyncTimer) return;

  pendingSyncTimer = setTimeout(() => {
    pendingSyncTimer = null;
    void pushListeningData();
  }, delayMs);
}

async function applyScope(uid: string | null): Promise<string> {
  const next = scopeForUid(uid);
  if (next === currentScope) return next;

  // The account being left gets its listening data uploaded before its stores close.
  const outgoingUid = uidForScope(currentScope);
  if (outgoingUid) {
    await pushListeningData(outgoingUid);
  }

  await db.setScope(next);
  currentScope = next;

  if (uid) {
    try {
      await pullAccountData(uid);
    } catch (err) {
      console.warn('Cloud library pull skipped:', err);
    }
  }

  notify(next);
  return next;
}

/**
 * Resolves once Firebase has reported who is signed in and the matching stores are open.
 * Everything that reads the library waits on this so a signed-in listener never gets a
 * frame of the guest library first.
 */
export function ensureAccountScopeReady(): Promise<string> {
  if (!readyPromise) {
    readyPromise = new Promise<string>((resolve) => {
      let settled = false;
      subscribeToAuth(async (user) => {
        try {
          await applyScope(user?.uid ?? null);
        } catch (err) {
          console.warn('Account scope change failed:', err);
        }
        if (!settled) {
          settled = true;
          resolve(currentScope);
        }
      });
    });
  }
  return readyPromise;
}

/**
 * IndexedDB storage engine for Celestial Music Player
 * Handles durable offline persistence for favorites, library, playlists, and history.
 */

import { Song, Album, Artist, Playlist, AppSettings, PlaybackState } from '../types';
import { auth, syncCachedSongToFirestore } from '../lib/firebase';
import { GUEST_SCOPE, scopeDbName, trimRecents } from './accountData';

const DB_NAME = 'CelestialMusicDB';
const DB_VERSION = 6;

const STORES = {
  FAVORITES: 'favorites',
  SAVED_ALBUMS: 'saved_albums',
  SAVED_ARTISTS: 'saved_artists',
  PLAYLISTS: 'playlists',
  RECENTLY_PLAYED: 'recently_played',
  APP_STATE: 'app_state',
  QUEUE_CACHE: 'queue_cache',
  TRACK_BLOBS: 'track_blobs',
} as const;

export function isDemoItem(item: any): boolean {
  if (!item) return false;
  const id = (item.id || '').toString().toLowerCase();
  const title = (item.title || '').toString().toLowerCase();
  const artist = (item.artist || item.artists || item.name || '').toString().toLowerCase();

  if (id.startsWith('demo-') || id.startsWith('mock-')) return true;
  if (
    title.includes('velvet horizon') ||
    title.includes('solar echoes') ||
    title.includes('midnight reverie') ||
    title.includes('cascades in minor') ||
    title.includes('echoes of eternity') ||
    title.includes('starlight sonata')
  ) {
    return true;
  }
  if (
    artist.includes('kaelen grey') ||
    artist.includes('lyra vance') ||
    artist.includes('aethelgard') ||
    artist.includes('elena rostova')
  ) {
    return true;
  }
  return false;
}

class CelestialDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private hasCleanedDemo = false;
  /** Which account this connection serves: 'guest' or 'u_<uid>'. */
  private scope: string = GUEST_SCOPE;
  /** Scope switches are serialised so two rapid sign-ins cannot interleave. */
  private scopeSwitch: Promise<void> = Promise.resolve();

  getScope(): string {
    return this.scope;
  }

  /**
   * Switches every library store to another account's database. The guest scope keeps the
   * original database file, so a device's existing library survives sign-out untouched.
   */
  setScope(next: string): Promise<void> {
    const target = (next || '').trim() || GUEST_SCOPE;
    this.scopeSwitch = this.scopeSwitch
      .then(async () => {
        if (target === this.scope) return;
        const previous = this.dbPromise;
        this.scope = target;
        this.dbPromise = null;
        this.hasCleanedDemo = false;
        if (previous) {
          try {
            (await previous).close();
          } catch {
            // A rejected open is fine: the next call opens the new scope from scratch.
          }
        }
      })
      .catch(() => {});
    return this.scopeSwitch;
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    const dbName = scopeDbName(this.scope, DB_NAME);

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = window.indexedDB.open(dbName, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for favorite song objects
        if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
          db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
        }

        // Store for saved albums
        if (!db.objectStoreNames.contains(STORES.SAVED_ALBUMS)) {
          db.createObjectStore(STORES.SAVED_ALBUMS, { keyPath: 'id' });
        }

        // Store for saved artists
        if (!db.objectStoreNames.contains(STORES.SAVED_ARTISTS)) {
          db.createObjectStore(STORES.SAVED_ARTISTS, { keyPath: 'id' });
        }

        // Store for user playlists
        if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
          db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
        }

        // Store for recently played songs
        if (!db.objectStoreNames.contains(STORES.RECENTLY_PLAYED)) {
          const store = db.createObjectStore(STORES.RECENTLY_PLAYED, { keyPath: 'id' });
          store.createIndex('playedAt', 'playedAt', { unique: false });
        }

        // Store for app settings & playback state
        if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
          db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
        }

        // Store for offline queue & next track cache
        if (!db.objectStoreNames.contains(STORES.QUEUE_CACHE)) {
          db.createObjectStore(STORES.QUEUE_CACHE, { keyPath: 'key' });
        }

        // Store for track audio blobs
        if (!db.objectStoreNames.contains(STORES.TRACK_BLOBS)) {
          db.createObjectStore(STORES.TRACK_BLOBS, { keyPath: 'songId' });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        // Purge any legacy synthetic fallback blobs on startup so genuine tracks are never poisoned
        try {
          if (database.objectStoreNames.contains(STORES.TRACK_BLOBS)) {
            const tx = database.transaction(STORES.TRACK_BLOBS, 'readwrite');
            const store = tx.objectStore(STORES.TRACK_BLOBS);
            const req = store.getAll();
            req.onsuccess = () => {
              const records = req.result || [];
              for (const record of records) {
                // If blob is small or synthesized wav, purge it
                if (record.blob && record.blob.type === 'audio/wav' && !record.songId?.startsWith('celestial-')) {
                  store.delete(record.songId);
                }
              }
            };
          }
        } catch {}
        resolve(database);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // Generic helper for transaction
  private async withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let callbackReturned: any;
      try {
        callbackReturned = callback(store, tx);
      } catch (err) {
        isSettled = true;
        reject(err);
        return;
      }

      if (callbackReturned && typeof callbackReturned.then === 'function') {
        callbackReturned
          .then((res: T) => {
            if (!isSettled) {
              isSettled = true;
              resolve(res);
            }
          })
          .catch((err: any) => {
            if (!isSettled) {
              isSettled = true;
              reject(err);
            }
          });
      } else {
        tx.oncomplete = () => {
          if (!isSettled) {
            isSettled = true;
            resolve(callbackReturned as T);
          }
        };
      }

      tx.onerror = () => {
        if (!isSettled) {
          isSettled = true;
          reject(tx.error);
        }
      };
      tx.onabort = () => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error('Transaction aborted'));
        }
      };
    });
  }

  /* ----------------- FAVORITES ----------------- */
  async getFavorites(): Promise<Song[]> {
    return this.withStore(STORES.FAVORITES, 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as Song[];
          const valid: Song[] = [];
          for (const item of list) {
            if (isDemoItem(item)) {
              store.delete(item.id);
            } else {
              valid.push(item);
            }
          }
          resolve(valid);
        };
        req.onerror = () => resolve([]);
      });
    });
  }

  async addFavorite(song: Song): Promise<void> {
    if (isDemoItem(song)) return;
    await this.withStore(STORES.FAVORITES, 'readwrite', (store) => {
      store.put(song);
    });
  }

  async removeFavorite(songId: string): Promise<void> {
    await this.withStore(STORES.FAVORITES, 'readwrite', (store) => {
      store.delete(songId);
    });
  }

  async isFavorite(songId: string): Promise<boolean> {
    if (isDemoItem({ id: songId })) return false;
    return this.withStore(STORES.FAVORITES, 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(songId);
        req.onsuccess = () => resolve(!!req.result);
      });
    });
  }

  /* ----------------- SAVED ALBUMS ----------------- */
  async getSavedAlbums(): Promise<Album[]> {
    return this.withStore(STORES.SAVED_ALBUMS, 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as Album[];
          const valid: Album[] = [];
          for (const item of list) {
            if (isDemoItem(item)) {
              store.delete(item.id);
            } else {
              valid.push(item);
            }
          }
          resolve(valid);
        };
        req.onerror = () => resolve([]);
      });
    });
  }

  async saveAlbum(album: Album): Promise<void> {
    if (isDemoItem(album)) return;
    await this.withStore(STORES.SAVED_ALBUMS, 'readwrite', (store) => {
      store.put(album);
    });
  }

  async removeSavedAlbum(albumId: string): Promise<void> {
    await this.withStore(STORES.SAVED_ALBUMS, 'readwrite', (store) => {
      store.delete(albumId);
    });
  }

  async isAlbumSaved(albumId: string): Promise<boolean> {
    return this.withStore(STORES.SAVED_ALBUMS, 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(albumId);
        req.onsuccess = () => resolve(!!req.result);
      });
    });
  }

  /* ----------------- SAVED ARTISTS ----------------- */
  async getSavedArtists(): Promise<Artist[]> {
    return this.withStore(STORES.SAVED_ARTISTS, 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as Artist[];
          const valid: Artist[] = [];
          for (const item of list) {
            if (isDemoItem(item)) {
              store.delete(item.id);
            } else {
              valid.push(item);
            }
          }
          resolve(valid);
        };
        req.onerror = () => resolve([]);
      });
    });
  }

  async saveArtist(artist: Artist): Promise<void> {
    if (isDemoItem(artist)) return;
    await this.withStore(STORES.SAVED_ARTISTS, 'readwrite', (store) => {
      store.put(artist);
    });
  }

  async removeSavedArtist(artistId: string): Promise<void> {
    await this.withStore(STORES.SAVED_ARTISTS, 'readwrite', (store) => {
      store.delete(artistId);
    });
  }

  async isArtistSaved(artistId: string): Promise<boolean> {
    return this.withStore(STORES.SAVED_ARTISTS, 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(artistId);
        req.onsuccess = () => resolve(!!req.result);
      });
    });
  }

  /* ----------------- PLAYLISTS ----------------- */
  async getPlaylists(): Promise<Playlist[]> {
    return this.withStore(STORES.PLAYLISTS, 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as Playlist[];
          const valid: Playlist[] = [];
          for (const item of list) {
            if (isDemoItem(item)) {
              store.delete(item.id);
            } else {
              // Also filter demo tracks inside the playlist
              if (Array.isArray(item.tracks)) {
                item.tracks = item.tracks.filter((t) => !isDemoItem(t));
                item.trackCount = item.tracks.length;
              }
              valid.push(item);
            }
          }
          resolve(valid);
        };
        req.onerror = () => resolve([]);
      });
    });
  }

  async getPlaylist(playlistId: string): Promise<Playlist | null> {
    return this.withStore(STORES.PLAYLISTS, 'readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(playlistId);
        req.onsuccess = () => resolve(req.result || null);
      });
    });
  }

  async savePlaylist(playlist: Playlist): Promise<void> {
    if (isDemoItem(playlist)) return;
    await this.withStore(STORES.PLAYLISTS, 'readwrite', (store) => {
      store.put(playlist);
    });
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.withStore(STORES.PLAYLISTS, 'readwrite', (store) => {
      store.delete(playlistId);
    });
  }

  /* ----------------- RECENTLY PLAYED ----------------- */
  async addRecentlyPlayed(song: Song): Promise<void> {
    if (!song || !song.id || isDemoItem(song)) return;
    const normKey = `${(song.title || '').trim().toLowerCase()}:::${(song.artist || '').trim().toLowerCase()}`;

    await this.withStore(STORES.RECENTLY_PLAYED, 'readwrite', (store) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as (Song & { playedAt?: number })[];
        // Purge any older entries matching exact ID or same normalized title+artist
        for (const item of list) {
          const itemKey = `${(item.title || '').trim().toLowerCase()}:::${(item.artist || '').trim().toLowerCase()}`;
          if (item.id === song.id || itemKey === normKey) {
            store.delete(item.id);
          }
        }
        const entry = {
          ...song,
          playedAt: Date.now(),
        };
        store.put(entry);
      };
    });
  }

  async getRecentlyPlayed(limit = 20): Promise<Song[]> {
    return this.withStore(STORES.RECENTLY_PLAYED, 'readwrite', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const raw = (req.result || []) as (Song & { playedAt?: number })[];
          const valid: (Song & { playedAt?: number })[] = [];
          const seenKeys = new Set<string>();

          // Sort by played timestamp descending
          raw.sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));

          for (const item of raw) {
            if (isDemoItem(item)) {
              store.delete(item.id);
              continue;
            }
            const normKey = `${(item.title || '').trim().toLowerCase()}:::${(item.artist || '').trim().toLowerCase()}`;
            if (seenKeys.has(normKey) || seenKeys.has(item.id)) {
              // Remove redundant duplicate clone from storage
              store.delete(item.id);
            } else {
              seenKeys.add(normKey);
              seenKeys.add(item.id);
              valid.push(item);
            }
          }
          resolve(valid.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    });
  }

  /**
   * Recent plays with their original timestamps. Unlike getRecentlyPlayed this is a plain
   * read: the account sync layer needs the history as it happened, not a rewritten one.
   */
  async getRecentEntries(limit = 50): Promise<(Song & { playedAt?: number })[]> {
    try {
      const entries = await this.withStore(STORES.RECENTLY_PLAYED, 'readonly', (store) => {
        return new Promise<(Song & { playedAt?: number })[]>((resolve) => {
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []) as (Song & { playedAt?: number })[]);
          req.onerror = () => resolve([]);
        });
      });
      return trimRecents(entries.filter((item) => item && !isDemoItem(item)), limit);
    } catch {
      return [];
    }
  }

  /**
   * Restores history from another device of the same account, keeping each play's real
   * timestamp so recency weighting stays truthful instead of pretending it all just played.
   */
  async importRecentEntries(entries: (Song & { playedAt?: number })[]): Promise<void> {
    const clean = trimRecents(
      (entries || []).filter((item) => item && item.id && !isDemoItem(item)),
      100
    );
    if (clean.length === 0) return;

    await this.withStore(STORES.RECENTLY_PLAYED, 'readwrite', (store) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const existing = new Set(
          ((req.result || []) as { id?: string }[]).map((item) => item.id).filter(Boolean)
        );
        for (const entry of clean) {
          if (existing.has(entry.id)) continue; // local history for this account wins
          store.put({ ...entry, playedAt: entry.playedAt || Date.now() });
        }
      };
    });
  }

  async clearRecentlyPlayed(): Promise<void> {
    await this.withStore(STORES.RECENTLY_PLAYED, 'readwrite', (store) => {
      store.clear();
    });
  }

  /* ----------------- APP STATE & SETTINGS ----------------- */
  async saveSetting<T>(key: string, value: T): Promise<void> {
    await this.withStore(STORES.APP_STATE, 'readwrite', (store) => {
      store.put({ key, value });
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    return this.saveSetting(key, value);
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      return await this.withStore(STORES.APP_STATE, 'readonly', (store) => {
        return new Promise((resolve) => {
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result && req.result.value !== undefined) {
              resolve(req.result.value);
            } else {
              resolve(defaultValue);
            }
          };
          req.onerror = () => resolve(defaultValue);
        });
      });
    } catch {
      return defaultValue;
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const storeNames = [
      STORES.FAVORITES,
      STORES.SAVED_ALBUMS,
      STORES.SAVED_ARTISTS,
      STORES.PLAYLISTS,
      STORES.RECENTLY_PLAYED,
    ];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      storeNames.forEach((name) => {
        tx.objectStore(name).clear();
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    return this.clearAllData();
  }

  /* ----------------- QUEUE & TRACK CACHE FOR SPOTTY CONNECTIVITY ----------------- */
  async cacheCurrentAndNextTrack(
    currentSong: Song | null,
    nextSong: Song | null,
    queue: Song[] = [],
    queueIndex: number = -1
  ): Promise<void> {
    try {
      await this.withStore(STORES.QUEUE_CACHE, 'readwrite', (store) => {
        if (currentSong) {
          store.put({ key: 'current_track', song: currentSong, cachedAt: Date.now() });
        } else {
          store.delete('current_track');
        }

        if (nextSong) {
          store.put({ key: 'next_track', song: nextSong, cachedAt: Date.now() });
        } else {
          store.delete('next_track');
        }

        if (queue && queue.length > 0) {
          store.put({ key: 'queue_snapshot', queue, queueIndex, cachedAt: Date.now() });
        }
      });

      // NOTE: do not pre-download audio blobs here. This runs on every track change, and
      // silently pulling the current + next track into IndexedDB competes with the stream
      // that is actually playing, which delays the next track's first bytes (very visible
      // when the phone is locked or on cellular). Explicit downloads still use
      // ensureAudioBlobCached / downloadTrackWithProgress on their own.
    } catch (err) {
      console.warn('Failed to cache current/next tracks to IndexedDB:', err);
    }
  }

  async backupAllCachedTracksToFirestore(): Promise<void> {
    try {
      const isBackupEnabled = await this.getSetting('offline_backup_enabled', false);
      if (!isBackupEnabled || !auth.currentUser) return;
      const userId = auth.currentUser.uid;

      const cachedQueue = await this.getCachedQueueTracks();
      const songsToSync: Song[] = [];
      if (cachedQueue.currentTrack && !isDemoItem(cachedQueue.currentTrack)) {
        songsToSync.push(cachedQueue.currentTrack);
      }
      if (cachedQueue.nextTrack && !isDemoItem(cachedQueue.nextTrack)) {
        songsToSync.push(cachedQueue.nextTrack);
      }
      if (cachedQueue.queue && cachedQueue.queue.length > 0) {
        for (const s of cachedQueue.queue) {
          if (s && !isDemoItem(s)) {
            songsToSync.push(s);
          }
        }
      }

      const favorites = await this.getFavorites();
      for (const s of favorites) {
        if (s && !isDemoItem(s)) {
          songsToSync.push(s);
        }
      }

      const uniqueSongs = Array.from(new Map(songsToSync.map(s => [s.id, s])).values());
      for (const song of uniqueSongs) {
        await syncCachedSongToFirestore(userId, song, true);
      }
    } catch (err) {
      console.warn('Failed to perform offline backup to Firestore:', err);
    }
  }

  async getCachedQueueTracks(): Promise<{
    currentTrack: Song | null;
    nextTrack: Song | null;
    queue: Song[];
    queueIndex: number;
  }> {
    try {
      return await this.withStore(STORES.QUEUE_CACHE, 'readonly', (store) => {
        return new Promise((resolve) => {
          const req = store.getAll();
          req.onsuccess = () => {
            const items = req.result || [];
            let currentTrack: Song | null = null;
            let nextTrack: Song | null = null;
            let queue: Song[] = [];
            let queueIndex = -1;

            for (const item of items) {
              if (item.key === 'current_track' && item.song) currentTrack = item.song;
              if (item.key === 'next_track' && item.song) nextTrack = item.song;
              if (item.key === 'queue_snapshot' && item.queue) {
                queue = item.queue;
                queueIndex = item.queueIndex ?? -1;
              }
            }

            resolve({ currentTrack, nextTrack, queue, queueIndex });
          };
          req.onerror = () => resolve({ currentTrack: null, nextTrack: null, queue: [], queueIndex: -1 });
        });
      });
    } catch {
      return { currentTrack: null, nextTrack: null, queue: [], queueIndex: -1 };
    }
  }

  /* ----------------- TRUE LOCAL OFFLINE AUDIO CACHING (SPOTIFY-STYLE) ----------------- */

  notifyDownloadsChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('celestial-downloads-changed'));
    }
  }

  async cacheTrackBlob(songId: string, blob: Blob, song?: Song): Promise<void> {
    if (!songId || !blob) return;
    try {
      const sanitizedSong: Song = song
        ? {
            id: String(song.id || songId),
            title: String(song.title || 'Offline Track'),
            artist: String(song.artist || song.artists || 'Unknown Artist'),
            artists: String(song.artists || song.artist || 'Unknown Artist'),
            artistId: song.artistId || '',
            album: String(song.album || 'Downloads'),
            albumId: song.albumId || '',
            artwork: song.artwork || song.artworkUrl || '',
            artworkUrl: song.artworkUrl || song.artwork || '',
            duration: Number(song.duration) || 240,
            provider: song.provider || 'youtube_music',
            providerUrl: song.providerUrl || '',
            streamUrl: `/api/song/${encodeURIComponent(songId)}/audio`,
            explicit: Boolean(song.explicit),
            dominantColor: song.dominantColor || '#0284c7',
            accentColor: song.accentColor || '#34d399',
          }
        : {
            id: songId,
            title: 'Offline Track',
            artist: 'Celestial Player',
            artists: 'Celestial Player',
            artistId: 'unknown',
            album: 'Downloads',
            albumId: 'downloads',
            duration: 240,
            artwork: '',
            artworkUrl: '',
            provider: 'youtube_music',
            streamUrl: `/api/song/${encodeURIComponent(songId)}/audio`,
          };

      await this.withStore(STORES.TRACK_BLOBS, 'readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const req = store.put({
            songId: String(songId),
            blob,
            song: sanitizedSong,
            sizeBytes: blob.size,
            cachedAt: Date.now(),
          });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      });
      this.notifyDownloadsChanged();
    } catch (err) {
      console.warn(`Failed to cache track blob for ${songId}:`, err);
    }
  }

  async getCachedTrackBlob(songId: string): Promise<Blob | null> {
    if (!songId) return null;
    try {
      return await this.withStore(STORES.TRACK_BLOBS, 'readonly', (store) => {
        return new Promise((resolve) => {
          const req = store.get(String(songId));
          req.onsuccess = () => {
            if (req.result && req.result.blob) {
              resolve(req.result.blob as Blob);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });
      });
    } catch {
      return null;
    }
  }

  async isTrackDownloaded(songId: string): Promise<boolean> {
    if (!songId) return false;
    try {
      const blob = await this.getCachedTrackBlob(songId);
      return Boolean(blob && blob.size > 0);
    } catch {
      return false;
    }
  }

  async getDownloadedSongs(): Promise<{ song: Song; sizeBytes: number; cachedAt: number }[]> {
    try {
      return await this.withStore(STORES.TRACK_BLOBS, 'readonly', (store) => {
        return new Promise((resolve) => {
          const req = store.getAll();
          req.onsuccess = () => {
            const records = req.result || [];
            const result: { song: Song; sizeBytes: number; cachedAt: number }[] = [];
            for (const r of records) {
              if (r.song && !isDemoItem(r.song)) {
                result.push({
                  song: r.song,
                  sizeBytes: r.sizeBytes || (r.blob ? r.blob.size : 0),
                  cachedAt: r.cachedAt || Date.now(),
                });
              } else if (r.songId) {
                result.push({
                  song: {
                    id: r.songId,
                    title: 'Offline Track',
                    artist: 'Celestial Player',
                    artists: 'Celestial Player',
                    artistId: 'unknown',
                    album: 'Offline Downloads',
                    albumId: 'offline',
                    duration: 240,
                    streamUrl: `/api/song/${encodeURIComponent(r.songId)}/audio`,
                    artworkUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
                  },
                  sizeBytes: r.sizeBytes || (r.blob ? r.blob.size : 0),
                  cachedAt: r.cachedAt || Date.now(),
                });
              }
            }
            result.sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
            resolve(result);
          };
          req.onerror = () => resolve([]);
        });
      });
    } catch {
      return [];
    }
  }

  async removeDownloadedTrack(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await this.withStore(STORES.TRACK_BLOBS, 'readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const req = store.delete(String(songId));
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      });
      this.notifyDownloadsChanged();
    } catch (err) {
      console.warn(`Failed to remove downloaded track ${songId}:`, err);
    }
  }

  async clearAllDownloadedTracks(): Promise<void> {
    try {
      await this.withStore(STORES.TRACK_BLOBS, 'readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      });
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          await caches.delete('celestial-artwork-cache');
        } catch {}
      }
      this.notifyDownloadsChanged();
    } catch (err) {
      console.warn('Failed to clear downloaded tracks:', err);
    }
  }

  async getOfflineStorageUsage(): Promise<{ totalBytes: number; count: number }> {
    try {
      const downloads = await this.getDownloadedSongs();
      const totalBytes = downloads.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
      return { totalBytes, count: downloads.length };
    } catch {
      return { totalBytes: 0, count: 0 };
    }
  }

  /**
   * Ensures that a song's audio blob is cached locally for true offline playback
   */
  async ensureAudioBlobCached(song: Song): Promise<boolean> {
    if (!song || isDemoItem(song)) return false;
    const isCached = await this.isTrackDownloaded(song.id);
    if (isCached) return true;
    return this.downloadTrackWithProgress(song);
  }

  /**
   * Downloads a song track for 100% offline playback (Spotify Premium style)
   * Streams audio bytes, reports progress, precaches artwork in CacheStorage,
   * and saves audio blob with metadata to IndexedDB.
   */
  async downloadTrackWithProgress(
    song: Song,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    if (!song || isDemoItem(song)) return false;

    try {
      // 1. Precache artwork image in CacheStorage for instant offline display
      if (typeof window !== 'undefined' && 'caches' in window && (song.artworkUrl || song.artwork)) {
        try {
          const cache = await caches.open('celestial-artwork-cache');
          const artUrl = song.artworkUrl || song.artwork;
          if (artUrl && artUrl.startsWith('http')) {
            cache.add(artUrl).catch(() => {});
          }
        } catch {}
      }

      // 2. Stream audio track from audio proxy endpoint with retry.
      // Metadata matters: the proxy matches the exact recording by title/artist/duration,
      // and downloadQuality decides which file is stored — the same inputs playback uses.
      let quality = 'high';
      try {
        const settings = await this.getSetting<{ downloadQuality?: string }>('celestial_settings', {});
        if (settings && typeof settings.downloadQuality === 'string' && settings.downloadQuality) {
          quality = settings.downloadQuality;
        }
      } catch {}
      const params = new URLSearchParams({
        title: song.title || '',
        artist: song.artist || song.artists || '',
        album: song.album || '',
        duration: String(Math.round(Number(song.duration) || 0)),
        quality,
      });
      const audioUrl = `/api/song/${encodeURIComponent(song.id)}/audio?${params.toString()}`;
      let response: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(audioUrl);
          if (response.ok || response.status === 206) break;
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      let blob: Blob | null = null;

      if (response && (response.ok || response.status === 206)) {
        const contentLengthHeader = response.headers.get('content-length');
        const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

        if (response.body && totalBytes > 0 && typeof response.body.getReader === 'function') {
          try {
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                if (onProgress) {
                  const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
                  onProgress(pct);
                }
              }
            }

            const mimeType = response.headers.get('content-type') || 'audio/webm';
            blob = new Blob(chunks, { type: mimeType });
          } catch (streamErr) {
            console.warn('Stream reader error, falling back to response.blob():', streamErr);
            blob = await response.blob();
          }
        } else {
          blob = await response.blob();
        }
      }

      if (onProgress) onProgress(100);

      // 3. Save audio blob (if genuinely fetched) and metadata to IndexedDB
      if (blob && blob.size > 1000) {
        await this.cacheTrackBlob(song.id, blob, song);
        this.notifyDownloadsChanged();
        return true;
      }

      // Nothing usable arrived. Saying "saved" here would put a tick next to a track
      // that cannot play offline, so this is reported as a failure instead.
      console.warn(`[OfflineDownload] No audio bytes stored for ${song.id}`);
      if (onProgress) onProgress(100);
      return false;
    } catch (err: any) {
      console.warn(`[OfflineDownload] Failed to download track ${song.id}:`, err?.message || err);
      return false;
    }
  }
}

export const db = new CelestialDatabase();

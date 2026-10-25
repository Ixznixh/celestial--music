import { Playlist, Song } from '../types';
import { db } from './indexedDB';

const localArtworkCache = new Map<string, string>();

/**
 * Checks if a track needs thumbnail resolution (missing, empty, or generic unsplash placeholder).
 */
export function isMissingArtwork(artworkUrl?: string): boolean {
  if (!artworkUrl || typeof artworkUrl !== 'string') return true;
  const trimmed = artworkUrl.trim();
  return (
    trimmed === '' ||
    trimmed.includes('unsplash.com') ||
    trimmed.includes('placeholder') ||
    trimmed === '/pwa-512x512.png'
  );
}

/**
 * Resolves artwork for a single song by title and artist.
 */
export async function fetchSongArtwork(title: string, artist?: string): Promise<string | undefined> {
  const cacheKey = `${title.toLowerCase().trim()}__${(artist || '').toLowerCase().trim()}`;
  if (localArtworkCache.has(cacheKey)) {
    return localArtworkCache.get(cacheKey);
  }

  try {
    const res = await fetch(`/api/song/artwork?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.artworkUrl) {
        localArtworkCache.set(cacheKey, data.artworkUrl);
        return data.artworkUrl;
      }
    }
  } catch {}
  return undefined;
}

/**
 * Automatically enriches missing track thumbnails in a playlist and persists to IndexedDB.
 */
export async function enrichPlaylistThumbnails(
  playlist: Playlist
): Promise<{ playlist: Playlist; updated: boolean }> {
  if (!playlist || !Array.isArray(playlist.tracks) || playlist.tracks.length === 0) {
    return { playlist, updated: false };
  }

  const missingTracks = playlist.tracks.filter((t) => isMissingArtwork(t.artworkUrl));
  const missingCover = isMissingArtwork(playlist.artworkUrl);
  const missingCollage = !playlist.collageArtworks || playlist.collageArtworks.length < Math.min(4, playlist.tracks.length);

  if (missingTracks.length === 0 && !missingCover && !missingCollage) {
    return { playlist, updated: false };
  }

  // Request batch artwork resolution from server
  let resolvedMap: Record<string, string> = {};
  if (missingTracks.length > 0) {
    try {
      const payload = missingTracks.slice(0, 60).map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
      }));

      const res = await fetch('/api/song/batch-artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: payload }),
      });

      if (res.ok) {
        const data = await res.json();
        resolvedMap = data.artworks || {};
      }
    } catch (err) {
      console.warn('Batch artwork resolution notice:', err);
    }
  }

  let wasChanged = false;
  const updatedTracks: Song[] = playlist.tracks.map((track) => {
    const resolved = resolvedMap[track.id];
    if (resolved && isMissingArtwork(track.artworkUrl)) {
      wasChanged = true;
      return { ...track, artworkUrl: resolved };
    }
    return track;
  });

  const validArtworks = Array.from(
    new Set(updatedTracks.map((t) => t.artworkUrl).filter((a) => !isMissingArtwork(a)))
  );

  const updatedCollage = validArtworks.slice(0, 4);
  const updatedCover =
    !isMissingArtwork(playlist.artworkUrl)
      ? playlist.artworkUrl
      : updatedCollage[0] || playlist.artworkUrl;

  if (updatedCover !== playlist.artworkUrl || updatedCollage.length !== (playlist.collageArtworks?.length || 0)) {
    wasChanged = true;
  }

  if (!wasChanged) {
    return { playlist, updated: false };
  }

  const enrichedPlaylist: Playlist = {
    ...playlist,
    artworkUrl: updatedCover,
    collageArtworks: updatedCollage,
    tracks: updatedTracks,
    updatedAt: Date.now(),
  };

  // Persist updated playlist with thumbnails to IndexedDB
  try {
    await db.savePlaylist(enrichedPlaylist);
  } catch (e) {
    console.warn('Could not persist enriched playlist to IndexedDB:', e);
  }

  return { playlist: enrichedPlaylist, updated: true };
}

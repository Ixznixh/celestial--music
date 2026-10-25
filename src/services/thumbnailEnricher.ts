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
    trimmed === '/pwa-512x512.png' ||
    trimmed.startsWith('data:image/svg')
  );
}

/**
 * Resolves artwork directly from JioSaavn by title and artist.
 */
export async function fetchSongArtwork(title: string, artist?: string): Promise<string | undefined> {
  if (!title || !title.trim()) return undefined;

  const rawTitle = title.trim();
  const rawArtist = (artist || '').trim();
  const cacheKey = `${rawTitle.toLowerCase()}__${rawArtist.toLowerCase()}`;

  if (localArtworkCache.has(cacheKey)) {
    return localArtworkCache.get(cacheKey);
  }

  // 1. Try server API endpoint
  try {
    const res = await fetch(
      `/api/song/artwork?title=${encodeURIComponent(rawTitle)}&artist=${encodeURIComponent(rawArtist)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.artworkUrl) {
        localArtworkCache.set(cacheKey, data.artworkUrl);
        return data.artworkUrl;
      }
    }
  } catch {}

  // 2. Direct client-side JioSaavn resolution fallback
  try {
    const cleanTitle = rawTitle.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').trim();
    const cleanArtist = rawArtist.split(/[,/&|;]/)[0].trim();
    const query = `${cleanTitle} ${cleanArtist}`.trim();
    const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const img = data.songs?.data?.[0]?.image;
      if (img && typeof img === 'string') {
        const highRes = img.replace(/-(?:50x50|150x150|250x250)\.jpg/i, '-500x500.jpg').replace('50x50', '500x500').replace('150x150', '500x500');
        localArtworkCache.set(cacheKey, highRes);
        return highRes;
      }
    }
  } catch {}

  return undefined;
}

/**
 * Automatically enriches missing track thumbnails in a playlist using JioSaavn and persists to IndexedDB.
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
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        resolvedMap = data.artworks || {};
      }
    } catch (err) {
      console.warn('Batch artwork resolution notice:', err);
    }

    // Direct fallback for any unresolved missing tracks (first 10)
    for (const track of missingTracks.slice(0, 10)) {
      if (!resolvedMap[track.id]) {
        try {
          const directArt = await fetchSongArtwork(track.title, track.artist);
          if (directArt) {
            resolvedMap[track.id] = directArt;
          }
        } catch {}
      }
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
      : updatedCollage[0] || validArtworks[0] || playlist.artworkUrl;

  if (
    updatedCover !== playlist.artworkUrl ||
    updatedCollage.length !== (playlist.collageArtworks?.length || 0) ||
    wasChanged
  ) {
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

  // Persist updated playlist with JioSaavn thumbnails to IndexedDB
  try {
    await db.savePlaylist(enrichedPlaylist);
  } catch (e) {
    console.warn('Could not persist enriched playlist to IndexedDB:', e);
  }

  return { playlist: enrichedPlaylist, updated: true };
}

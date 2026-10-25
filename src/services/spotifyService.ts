import { Song, Playlist } from '../types';
import { db } from './indexedDB';
import { auth, syncPlaylistToFirestore } from '../lib/firebase';

export interface SpotifyImportResult {
  playlist: Playlist;
  tracks: Song[];
}

export interface CuratedSpotifyPlaylist {
  id: string;
  type?: string;
  title: string;
  description: string;
  artworkUrl: string;
  trackCount?: number;
}

export const FALLBACK_CURATED_PLAYLISTS: CuratedSpotifyPlaylist[] = [
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    title: "Today's Top Hits",
    description: 'The biggest hits right now across pop, dance and hip-hop.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DX0XUsuxWHRQd',
    title: 'RapCaviar',
    description: 'New music from Drake, Kendrick Lamar, Future and hip-hop icons.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002882f0fa3c1bf367ff122e283',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DX4o1oenSJRJd',
    title: 'All Out 2000s',
    description: 'The biggest and most memorable songs of the 2000s.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002b54203df569c73b06bc91d29',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DXdLEN7aqioXM',
    title: 'Lo-Fi Beats',
    description: 'Chill beats, instrumental vibes and lo-fi melodies for focus.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f0000000254473de87526aec8577239ef',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DWUa8ZRTfalHk',
    title: 'Pop Rising',
    description: 'The next generation of pop music superstars.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f000000028e370a25695669b91ad8ee64',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DWZeKCadgRdKQ',
    title: 'Deep Focus',
    description: 'Ambient atmospheric soundscapes for deep flow states.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002d073e6f3e5cbd79ea7472123',
    trackCount: 50,
  },
];

/**
 * Fetch list of curated popular Spotify playlists
 */
export async function fetchCuratedSpotifyPlaylists(): Promise<CuratedSpotifyPlaylist[]> {
  try {
    const res = await fetch('/api/spotify/featured');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.playlists) && data.playlists.length > 0) {
        return data.playlists;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server curated Spotify playlists, using defaults:', err);
  }
  return FALLBACK_CURATED_PLAYLISTS;
}

/**
 * Fetch and import a Spotify playlist or album by URL or ID.
 * Automatically persists to IndexedDB and Firestore (if user signed in).
 */
export async function importSpotifyPlaylist(urlOrId: string): Promise<SpotifyImportResult> {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    throw new Error('Please enter a Spotify playlist link or ID');
  }

  const endpoint = `/api/spotify/playlist?url=${encodeURIComponent(trimmed)}`;
  const res = await fetch(endpoint);

  if (!res.ok) {
    let errorMsg = `Failed to fetch Spotify playlist (status ${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.tracks) || data.tracks.length === 0) {
    throw new Error('No tracks found in this Spotify playlist or album.');
  }

  const cleanTracks: Song[] = data.tracks.map((t: any, index: number) => {
    const rawTrackId = t.id || `sp_track_${Date.now()}_${index}`;
    const artist = t.artist || 'Unknown Artist';
    const trackTitle = t.title || 'Untitled Track';
    const albumName = t.album || data.title || 'Spotify Playlist';
    const duration = Number(t.duration) || 180;
    const artworkUrl =
      t.artworkUrl ||
      data.artworkUrl ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';

    return {
      id: rawTrackId,
      title: trackTitle,
      artist,
      artistId: `sp_art_${encodeURIComponent(artist.slice(0, 30))}`,
      album: albumName,
      albumId: `sp_alb_${data.id || 'playlist'}`,
      artworkUrl,
      duration,
      streamUrl: `/api/song/${encodeURIComponent(rawTrackId)}/audio?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(artist)}&duration=${duration}`,
      source: 'spotify' as const,
    };
  });

  const collageArtworks = Array.from(
    new Set(cleanTracks.map((t) => t.artworkUrl).filter(Boolean))
  ).slice(0, 4);

  const playlist: Playlist = {
    id: `spotify-pl-${data.id || Date.now()}`,
    title: data.title || 'Spotify Imported Playlist',
    description: data.description || 'Imported from Spotify',
    artworkUrl:
      data.artworkUrl ||
      cleanTracks[0]?.artworkUrl ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    collageArtworks,
    trackCount: cleanTracks.length,
    totalDuration: cleanTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    tracks: cleanTracks,
    isCustom: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 1. Save to local IndexedDB
  await db.savePlaylist(playlist);

  // 2. Sync to Firestore if authenticated
  const uid = auth.currentUser?.uid;
  if (uid) {
    syncPlaylistToFirestore(uid, playlist).catch(() => {});
  }

  // 3. Dispatch global event so UI reacts immediately
  window.dispatchEvent(new CustomEvent('celestial-playlist-imported', { detail: { playlist } }));
  window.dispatchEvent(new CustomEvent('celestial-downloads-changed'));

  return { playlist, tracks: cleanTracks };
}

/**
 * Import a playlist from raw text (e.g. lines of "Artist - Song Title" or CSV export)
 */
export async function importPlaylistFromText(
  title: string,
  rawText: string,
  description?: string
): Promise<SpotifyImportResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    throw new Error('Please enter at least one song (format: "Artist - Title" or "Title")');
  }

  const cleanTracks: Song[] = lines.map((line, idx) => {
    let artist = 'Various Artists';
    let trackTitle = line;

    // Detect CSV or separator like "-" or "–" or "\t"
    if (line.includes('\t')) {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length >= 2) {
        trackTitle = parts[0];
        artist = parts[1];
      }
    } else if (line.includes(' - ')) {
      const parts = line.split(' - ').map((p) => p.trim());
      artist = parts[0];
      trackTitle = parts.slice(1).join(' - ');
    } else if (line.includes(' – ')) {
      const parts = line.split(' – ').map((p) => p.trim());
      artist = parts[0];
      trackTitle = parts.slice(1).join(' – ');
    } else if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        trackTitle = parts[0];
        artist = parts[1];
      }
    }

    const trackId = `text_import_${Date.now()}_${idx}`;
    return {
      id: trackId,
      title: trackTitle,
      artist: artist,
      artistId: `art_${encodeURIComponent(artist.slice(0, 30))}`,
      album: title,
      albumId: `alb_${Date.now()}`,
      artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      duration: 210,
      streamUrl: `/api/song/${encodeURIComponent(trackId)}/audio?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(artist)}&duration=210`,
      source: 'spotify' as const,
    };
  });

  const playlist: Playlist = {
    id: `custom-import-${Date.now()}`,
    title: title.trim() || 'Custom Imported Playlist',
    description: description?.trim() || `Imported ${cleanTracks.length} tracks`,
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    collageArtworks: [],
    trackCount: cleanTracks.length,
    totalDuration: cleanTracks.length * 210,
    tracks: cleanTracks,
    isCustom: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.savePlaylist(playlist);

  const uid = auth.currentUser?.uid;
  if (uid) {
    syncPlaylistToFirestore(uid, playlist).catch(() => {});
  }

  window.dispatchEvent(new CustomEvent('celestial-playlist-imported', { detail: { playlist } }));
  window.dispatchEvent(new CustomEvent('celestial-downloads-changed'));

  return { playlist, tracks: cleanTracks };
}

import { youtubeMusicService } from './youtubeMusic';

const thumbnailCache = new Map<string, string>();

/**
 * Resolves high-resolution artwork for a track by title and artist.
 * Uses JioSaavn autocomplete (ultra-fast, ~50ms, 500x500 CDN images) first,
 * and falls back to YouTube Music Innertube search.
 */
export async function resolveTrackArtwork(title: string, artist?: string): Promise<string | undefined> {
  if (!title || !title.trim()) return undefined;

  const cacheKey = `${title.trim().toLowerCase()}__${(artist || '').trim().toLowerCase()}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  const cleanTitle = title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/ft\..*$/i, '')
    .replace(/feat\..*$/i, '')
    .replace(/[\(\)\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanArtist = (artist || '')
    .split(/[,/&|;]/)[0]
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .trim();

  // 1. Primary: JioSaavn Autocomplete API (returns crisp 500x500 CDN image in ~50ms)
  try {
    const query = `${cleanTitle} ${cleanArtist}`.trim();
    const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const firstSong = data.songs?.data?.[0];
      if (firstSong?.image) {
        const highRes = firstSong.image.replace('50x50', '500x500').replace('150x150', '500x500');
        thumbnailCache.set(cacheKey, highRes);
        return highRes;
      }
    }
  } catch {}

  // 2. Secondary: YouTube Music Innertube candidate lookup
  try {
    const candidates = await youtubeMusicService.getCandidatesForTrack(
      `art_${encodeURIComponent(cleanTitle.slice(0, 20))}`,
      cleanTitle,
      cleanArtist
    );
    if (candidates && candidates.length > 0 && candidates[0].artworkUrl) {
      let art = candidates[0].artworkUrl;
      if (art.includes('i.ytimg.com')) {
        art = art.replace(/hq720\.jpg/i, 'hqdefault.jpg');
      }
      thumbnailCache.set(cacheKey, art);
      return art;
    }
  } catch {}

  return undefined;
}

/**
 * Batch resolve artworks for an array of tracks in parallel chunks of 8.
 */
export async function batchResolveArtworks(
  tracks: Array<{ id?: string; title: string; artist?: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const CHUNK_SIZE = 8;

  for (let i = 0; i < tracks.length; i += CHUNK_SIZE) {
    const chunk = tracks.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (t) => {
        const key = t.id || `${t.title}_${t.artist || ''}`;
        const artwork = await resolveTrackArtwork(t.title, t.artist);
        if (artwork) {
          result.set(key, artwork);
        }
      })
    );
  }

  return result;
}

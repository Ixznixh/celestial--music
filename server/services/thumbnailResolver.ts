/**
 * JioSaavn Thumbnail Resolver
 * Ultra-fast CDN resolution (<100ms) for crystal clear 500x500 artwork.
 */

const thumbnailCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

function cleanString(str: string): string {
  return str
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/ft\..*$/i, '')
    .replace(/feat\..*$/i, '')
    .replace(/[\(\)\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves high-resolution 500x500 artwork from JioSaavn by title and artist.
 */
export async function resolveTrackArtwork(title: string, artist?: string): Promise<string | undefined> {
  if (!title || !title.trim()) return undefined;

  const rawTitle = title.trim();
  const rawArtist = (artist || '').trim();
  const cacheKey = `${rawTitle.toLowerCase()}__${rawArtist.toLowerCase()}`;

  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  const cleanTitle = cleanString(rawTitle);
  const cleanArtist = rawArtist
    .split(/[,/&|;]/)[0]
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .trim();

  const queries = [
    `${cleanTitle} ${cleanArtist}`.trim(),
    cleanTitle,
  ].filter(Boolean);

  for (const q of queries) {
    // 1. Try JioSaavn Autocomplete API (ultra-fast, ~50ms)
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = await res.json();
        const img = data.songs?.data?.[0]?.image;
        if (img && typeof img === 'string') {
          const highRes = img.replace(/-(?:50x50|150x150|250x250)\.jpg/i, '-500x500.jpg').replace('50x50', '500x500').replace('150x150', '500x500');
          if (thumbnailCache.size >= MAX_CACHE_SIZE) {
            const firstKey = thumbnailCache.keys().next().value;
            if (firstKey) thumbnailCache.delete(firstKey);
          }
          thumbnailCache.set(cacheKey, highRes);
          return highRes;
        }
      }
    } catch {}

    // 2. Try JioSaavn Search API if autocomplete did not return results
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = await res.json();
        const img = data.results?.[0]?.image;
        if (img && typeof img === 'string') {
          const highRes = img.replace(/-(?:50x50|150x150|250x250)\.jpg/i, '-500x500.jpg').replace('50x50', '500x500').replace('150x150', '500x500');
          if (thumbnailCache.size >= MAX_CACHE_SIZE) {
            const firstKey = thumbnailCache.keys().next().value;
            if (firstKey) thumbnailCache.delete(firstKey);
          }
          thumbnailCache.set(cacheKey, highRes);
          return highRes;
        }
      }
    } catch {}
  }

  return undefined;
}

/**
 * Batch resolve artworks for an array of tracks in parallel chunks using JioSaavn.
 */
export async function batchResolveArtworks(
  tracks: Array<{ id?: string; title: string; artist?: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const CHUNK_SIZE = 16;

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

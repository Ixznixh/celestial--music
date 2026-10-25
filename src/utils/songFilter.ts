/**
 * songFilter.ts
 *
 * Enforces strict filtering of individual, proper songs across feeds, queues,
 * and searches. Disqualifies full album audio jukeboxes, compilations, multi-hour
 * mixes, non-stop playlists, podcast uploads, and any track outside standard
 * song duration (30s - 510s).
 */

export const MAX_SONG_DURATION_SECONDS = 510; // 8 minutes 30 seconds
export const MIN_SONG_DURATION_SECONDS = 30;  // 30 seconds

export const COMPILATION_PATTERNS: RegExp[] = [
  /\bjukebox\b/i,
  /\baudio\s*jukebox\b/i,
  /\bvideo\s*jukebox\b/i,
  /\bfull\s*album\b/i,
  /\bentire\s*album\b/i,
  /\bcomplete\s*album\b/i,
  /\ball\s*songs\b/i,
  /\bsongs?\s*collection\b/i,
  /\baudio\s*collection\b/i,
  /\bmegamix\b/i,
  /\bmega\s*mix\b/i,
  /\bnon[- ]?stop\b/i,
  /\bcompilation\b/i,
  /\bdiscography\b/i,
  /\bbgm\s*collection\b/i,
  /\btheme\s*collection\b/i,
  /\bsoundtrack\s*collection\b/i,
  /\bfull\s*ost\b/i,
  /\bost\s*collection\b/i,
  /\b\d+\s*(?:hours?|hrs?)\b/i,
  /\bcontinuous\s*mix\b/i,
  /\balbum\s*stream\b/i,
  /\bcomplete\s*soundtrack\b/i,
  /\ball\s*audio\s*songs\b/i,
  /\ball\s*video\s*songs\b/i,
  /\bmashup\b/i,
];

/**
 * Returns true only if item is a legitimate individual musical song track.
 */
export function isProperSongTrack(
  song: { title?: string; artist?: string; album?: string; duration?: number } | null | undefined
): boolean {
  if (!song) return false;

  const title = String(song.title || '').trim();
  if (!title || title.toLowerCase() === 'unknown track') return false;

  // Strict Duration Check: Proper individual songs are between 30s and 8.5m
  if (typeof song.duration === 'number' && song.duration > 0) {
    if (song.duration < MIN_SONG_DURATION_SECONDS || song.duration > MAX_SONG_DURATION_SECONDS) {
      return false;
    }
  }

  // Exact non-song / compilation single titles
  if (/^(jukebox|music|songs|playlist|full album|mixtape|mashup|all songs|audio jukebox|video jukebox)$/i.test(title)) {
    return false;
  }

  // Check compilation patterns in title
  for (const pattern of COMPILATION_PATTERNS) {
    if (pattern.test(title)) {
      // Allow well-known individual song title edge cases:
      // "Jukebox Hero" by Foreigner, "Jukebox Joints" by A$AP Rocky
      if (/\bjukebox\b/i.test(pattern.source) && /\bjukebox\s+(?:hero|joints)\b/i.test(title)) {
        continue;
      }
      return false;
    }
  }

  // Check compilation patterns in album
  const album = String(song.album || '').trim();
  if (album) {
    for (const pattern of COMPILATION_PATTERNS) {
      if (pattern.test(album)) {
        if (/\bjukebox\b/i.test(pattern.source) && /\bjukebox\s+(?:hero|joints)\b/i.test(album)) {
          continue;
        }
        return false;
      }
    }
  }

  // "Best of <Artist>" compilation uploads (exclude individual songs: "Best of Me", "Best of You", etc.)
  if (/\b(?:the\s+)?best\s+of\b/i.test(title) && !/\b(?:the\s+)?best\s+of\s+(?:me|you|us|both|my|mine|times|life|luck|it)\b/i.test(title)) {
    return false;
  }

  const artist = String(song.artist || '').trim();
  if (artist && /\b(jukebox|compilation|records\s*compilation|non[- ]?stop)\b/i.test(artist)) {
    return false;
  }

  return true;
}

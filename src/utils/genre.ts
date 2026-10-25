/**
 * Genre & Mood Detection Engine
 * Matches songs to accurate genres and musical moods (Spotify-style)
 */

export interface GenreTheme {
  label: string;
  color: string;
  bg: string;
  border: string;
  emoji: string;
}

export const GENRE_THEMES: Record<string, GenreTheme> = {
  'Melody & Soul': {
    label: 'Melody & Soul',
    color: 'text-rose-300',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    emoji: '🎵',
  },
  'Kuthu & Dance': {
    label: 'Kuthu & Dance',
    color: 'text-amber-300',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    emoji: '🔥',
  },
  'High Energy & Pop': {
    label: 'High Energy & Pop',
    color: 'text-orange-300',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/30',
    emoji: '⚡',
  },
  'Hip-Hop & Rap': {
    label: 'Hip-Hop & Rap',
    color: 'text-purple-300',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    emoji: '🎤',
  },
  'Lo-Fi & Chill': {
    label: 'Lo-Fi & Chill',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    emoji: '🌙',
  },
  'EDM & Remix': {
    label: 'EDM & Remix',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    emoji: '🎧',
  },
  'Golden Classics': {
    label: 'Golden Classics',
    color: 'text-yellow-300',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/30',
    emoji: '✨',
  },
  'Indie & Alternative': {
    label: 'Indie & Alternative',
    color: 'text-blue-300',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    emoji: '🎸',
  },
  'Pop & Soundtracks': {
    label: 'Pop & Soundtracks',
    color: 'text-neutral-300',
    bg: 'bg-white/10',
    border: 'border-white/15',
    emoji: '🎶',
  },
};

/**
 * Detects the genre and mood of a song based on its title, artist, and album.
 */
export function detectSongGenre(song: { title?: string; artist?: string; album?: string; genre?: string }): string {
  if (song.genre && GENRE_THEMES[song.genre]) {
    return song.genre;
  }

  const title = (song.title || '').toLowerCase();
  const artist = (song.artist || '').toLowerCase();
  const album = (song.album || '').toLowerCase();
  const combined = `${title} ${artist} ${album}`;

  // 1. Specific style / mood keywords
  if (/\b(kuthu|dappan|marana|beat|party|dance|club|thara|kuththu|folk|gaana|naattupura)\b/i.test(combined)) {
    return 'Kuthu & Dance';
  }
  if (/\b(melody|love|kadhal|romantic|feelings|soul|heart|unplugged|acoustic|piano|sad|pain|neethane|piriyadha)\b/i.test(combined)) {
    return 'Melody & Soul';
  }
  if (/\b(lo-?fi|chill|slowed|reverb|ambient|relax|sleep|study|night|breeze|rain)\b/i.test(combined)) {
    return 'Lo-Fi & Chill';
  }
  if (/\b(rap|hip-?hop|trap|drill|cypher|freestyle|bars|flow)\b/i.test(combined)) {
    return 'Hip-Hop & Rap';
  }
  if (/\b(remix|edm|house|techno|trance|electro|dj|drop|club mix)\b/i.test(combined)) {
    return 'EDM & Remix';
  }
  if (/\b(rock|metal|guitar|punk|alternative|band)\b/i.test(combined)) {
    return 'Indie & Alternative';
  }
  if (/\b(carnatic|classical|devotional|bhajan|bakthi|temple|shiva|murugan|ragam)\b/i.test(combined)) {
    return 'Golden Classics';
  }

  // 2. Artist signature styles
  if (/\b(anirudh|santhosh narayanan|hiphop tamizha|sam c\.?s|thaman|devi sri prasad|dsp)\b/i.test(artist)) {
    return 'High Energy & Pop';
  }
  if (/\b(a\.?r\.?\s*rahman|harris jayaraj|sid sriram|yuvan|pradeep kumar|dhee|shreya ghoshal|chinmayi|harini|jonita)\b/i.test(artist)) {
    return 'Melody & Soul';
  }
  if (/\b(ilaiyaraaja|spb|s\.?p\.?\s*balasubrahmanyam|yesudas|janaki|chithra|m\.?s\.?\s*v|susheela)\b/i.test(artist)) {
    return 'Golden Classics';
  }
  if (/\b(paal dabba|asal kolaar|ofro|arivu|mc valluvar|mc stan|raftaar|divine|seedhe maut)\b/i.test(artist)) {
    return 'Hip-Hop & Rap';
  }
  if (/\b(the weeknd|drake|eminem|travis scott|kanye|kendrick|post malone)\b/i.test(artist)) {
    return 'Hip-Hop & Rap';
  }
  if (/\b(alan walker|marshmello|martin garrix|david guetta|avicii|chainsmokers|skrillex)\b/i.test(artist)) {
    return 'EDM & Remix';
  }
  if (/\b(taylor swift|ariana|dua lipa|billie eilish|ed sheeran|justin bieber|olivia rodrigo|katy perry)\b/i.test(artist)) {
    return 'High Energy & Pop';
  }
  if (/\b(coldplay|imagine dragons|queen|linkin park|maroon 5|arctic monkeys)\b/i.test(artist)) {
    return 'Indie & Alternative';
  }

  return 'Pop & Soundtracks';
}

/**
 * Returns visual styling tokens for a given genre.
 */
export function getGenreTheme(genre?: string): GenreTheme {
  if (genre && GENRE_THEMES[genre]) {
    return GENRE_THEMES[genre];
  }
  return GENRE_THEMES['Pop & Soundtracks'];
}

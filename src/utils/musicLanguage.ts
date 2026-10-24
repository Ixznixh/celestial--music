import { Song } from '../types';

export const MUSIC_LANGUAGES = [
  { code: 'as', label: 'Assamese' },
  { code: 'bn', label: 'Bengali' },
  { code: 'brx', label: 'Bodo' },
  { code: 'doi', label: 'Dogri' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ks', label: 'Kashmiri' },
  { code: 'kok', label: 'Konkani' },
  { code: 'mai', label: 'Maithili' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mni', label: 'Manipuri (Meitei)' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ne', label: 'Nepali' },
  { code: 'or', label: 'Odia' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'sat', label: 'Santali' },
  { code: 'sd', label: 'Sindhi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ur', label: 'Urdu' },
  { code: 'en', label: 'English' },
] as const;

const LANGUAGE_ALIASES = new Map<string, string>();
for (const { code, label } of MUSIC_LANGUAGES) {
  LANGUAGE_ALIASES.set(code, code);
  LANGUAGE_ALIASES.set(label.toLowerCase(), code);
}
LANGUAGE_ALIASES.set('manipuri', 'mni');
LANGUAGE_ALIASES.set('meitei', 'mni');
LANGUAGE_ALIASES.set('manipuri (meitei)', 'mni');
LANGUAGE_ALIASES.set('oriya', 'or');
LANGUAGE_ALIASES.set('all languages', 'all');
LANGUAGE_ALIASES.set('all', 'all');

export function normalizeMusicLanguage(value?: string | null): string | undefined {
  if (!value) return undefined;
  return LANGUAGE_ALIASES.get(value.trim().toLowerCase());
}

export function matchesMusicLanguage(song: Pick<Song, 'language'>, selected?: string): boolean {
  if (!selected || selected === 'all') return true;
  const songLanguage = normalizeMusicLanguage(song.language);
  return Boolean(songLanguage && songLanguage === normalizeMusicLanguage(selected));
}

export function filterSongsByLanguage<T extends Pick<Song, 'language'>>(
  songs: T[],
  selected?: string
): T[] {
  return songs.filter((song) => matchesMusicLanguage(song, selected));
}

export function resolveRecommendationLanguage(
  songLanguage?: string | null,
  preference?: string | null
): string | undefined | null {
  const preferred = normalizeMusicLanguage(preference);
  const current = normalizeMusicLanguage(songLanguage);
  if (preferred && preferred !== 'all' && !current) return null;
  return current || (preferred === 'all' ? undefined : preferred);
}

export function isCurrentSuggestionResponse(
  requestId: number,
  activeRequestId: number,
  targetSongId: string,
  currentSongId?: string | null
): boolean {
  return requestId === activeRequestId && targetSongId === currentSongId;
}

export function rankSearchSongs(songs: Song[], query: string, language?: string): Song[] {
  const term = query.trim().toLocaleLowerCase();
  return [...songs].sort((left, right) => {
    const score = (song: Song) => {
      const title = song.title.toLocaleLowerCase();
      const artist = song.artist.toLocaleLowerCase();
      let value = title === term ? 100 : title.startsWith(term) ? 60 : title.includes(term) ? 30 : 0;
      if (artist === term) value += 50;
      if (artist.startsWith(term)) value += 20;
      if (language && language !== 'all' &&
          normalizeMusicLanguage(song.language) === normalizeMusicLanguage(language)) value += 25;
      value += Math.min(10, Math.log10((song.plays || 0) + 1));
      return value;
    };
    return score(right) - score(left);
  });
}

import { describe, expect, it } from 'vitest';
import {
  filterSongsByLanguage,
  isCurrentSuggestionResponse,
  MUSIC_LANGUAGES,
  normalizeMusicLanguage,
  rankSearchSongs,
  resolveRecommendationLanguage,
} from '../musicLanguage';
import { loadMusicLanguagePreference, saveMusicLanguagePreference } from '../../services/musicLanguagePreference';
import { Song } from '../../types';

function song(id: string, title: string, artist: string, language?: string, plays?: number): Song {
  return {
    id,
    title,
    artist,
    artistId: '',
    album: '',
    albumId: '',
    duration: 180,
    streamUrl: '',
    artworkUrl: '',
    language,
    plays,
  };
}

describe('music-language preference and filtering', () => {
  it('offers every supported language and normalizes provider labels', () => {
    expect(MUSIC_LANGUAGES.map(({ label }) => label)).toEqual([
      'Assamese', 'Bengali', 'Bodo', 'Dogri', 'Gujarati', 'Hindi', 'Kannada',
      'Kashmiri', 'Konkani', 'Maithili', 'Malayalam', 'Manipuri (Meitei)',
      'Marathi', 'Nepali', 'Odia', 'Punjabi', 'Sanskrit', 'Santali', 'Sindhi',
      'Tamil', 'Telugu', 'Urdu', 'English',
    ]);
    expect(normalizeMusicLanguage('Hindi')).toBe('hi');
    expect(normalizeMusicLanguage('Manipuri')).toBe('mni');
  });

  it('persists and clears the local preference', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    } as Storage;

    saveMusicLanguagePreference('bn', storage);
    expect(loadMusicLanguagePreference(storage)).toBe('bn');
    saveMusicLanguagePreference(undefined, storage);
    expect(loadMusicLanguagePreference(storage)).toBeUndefined();
  });

  it('filters only explicit matching language metadata, never script or title guesses', () => {
    const songs = [
      song('1', 'Hindi Song', 'Artist A', 'Hindi'),
      song('2', 'বাংলা গান', 'Artist B'),
      song('3', 'A Hindi-titled song', 'Hindi Artist'),
    ];
    expect(filterSongsByLanguage(songs, 'hi').map(({ id }) => id)).toEqual(['1']);
    expect(filterSongsByLanguage(songs, 'all')).toHaveLength(3);
  });

  it('uses a known playing-song language and declines to invent one when missing', () => {
    expect(resolveRecommendationLanguage('Tamil', 'Hindi')).toBe('ta');
    expect(resolveRecommendationLanguage(undefined, 'Hindi')).toBeNull();
    expect(resolveRecommendationLanguage(undefined, 'all')).toBeUndefined();
  });
});

describe('search ranking and stale recommendation protection', () => {
  it('ranks exact titles and selected-language metadata without hiding other languages', () => {
    const songs = [
      song('other', 'Saami', 'Artist', 'Hindi', 900),
      song('exact', 'Saami', 'Artist', 'Tamil', 10),
      song('artist', 'Other Song', 'Saami', 'Hindi', 10),
    ];
    expect(rankSearchSongs(songs, 'Saami', 'ta').map(({ id }) => id)).toEqual(['exact', 'other', 'artist']);
  });

  it('rejects responses from an older request or a previous song', () => {
    expect(isCurrentSuggestionResponse(2, 2, 'song-b', 'song-b')).toBe(true);
    expect(isCurrentSuggestionResponse(1, 2, 'song-a', 'song-b')).toBe(false);
    expect(isCurrentSuggestionResponse(2, 2, 'song-a', 'song-b')).toBe(false);
  });
});

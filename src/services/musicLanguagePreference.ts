const MUSIC_LANGUAGE_KEY = 'celestial_music_language';

function getStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export function loadMusicLanguagePreference(storage?: Storage): string | undefined {
  const target = getStorage(storage);
  if (!target) return undefined;
  try {
    return target.getItem(MUSIC_LANGUAGE_KEY) || undefined;
  } catch (error) {
    console.warn('Could not read the local music-language preference:', error);
    return undefined;
  }
}

export function saveMusicLanguagePreference(language: string | undefined, storage?: Storage): void {
  const target = getStorage(storage);
  if (!target) return;
  try {
    if (language) target.setItem(MUSIC_LANGUAGE_KEY, language);
    else target.removeItem(MUSIC_LANGUAGE_KEY);
  } catch (error) {
    console.warn('Could not save the local music-language preference:', error);
  }
}

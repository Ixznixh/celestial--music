import { Song } from '../types';

export const PLAYBACK_SESSION_STORAGE_KEY = 'celestial_player_playback_state';

export interface PlaybackSessionSnapshot {
  currentSong: Song | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  savedAt?: number;
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export function savePlaybackSession(
  snapshot: PlaybackSessionSnapshot,
  storage?: Storage
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.setItem(PLAYBACK_SESSION_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      savedAt: Date.now(),
    }));
    return true;
  } catch (error) {
    console.warn('Could not persist the playback session:', error);
    return false;
  }
}

export function loadPlaybackSession(storage?: Storage): PlaybackSessionSnapshot | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const value = target.getItem(PLAYBACK_SESSION_STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;

    const session = parsed as Partial<PlaybackSessionSnapshot>;
    const song = session.currentSong;
    if (
      !song ||
      typeof song.id !== 'string' ||
      typeof song.title !== 'string' ||
      !Number.isFinite(session.currentTime) ||
      (session.currentTime as number) < 0 ||
      !Number.isFinite(session.duration) ||
      (session.duration as number) < 0 ||
      !Number.isFinite(session.volume) ||
      (session.volume as number) < 0 ||
      (session.volume as number) > 1
    ) {
      return null;
    }

    return {
      currentSong: song,
      currentTime: session.currentTime as number,
      duration: Number.isFinite(session.duration) ? session.duration as number : song.duration || 0,
      volume: Number.isFinite(session.volume) ? session.volume as number : 0.85,
      isMuted: Boolean(session.isMuted),
      savedAt: Number.isFinite(session.savedAt) ? session.savedAt : undefined,
    };
  } catch (error) {
    console.warn('Could not restore the playback session:', error);
    return null;
  }
}
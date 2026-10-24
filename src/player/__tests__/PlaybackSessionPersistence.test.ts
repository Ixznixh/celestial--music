import { describe, expect, it } from 'vitest';
import { Song } from '../../types';
import {
  loadPlaybackSession,
  PLAYBACK_SESSION_STORAGE_KEY,
  savePlaybackSession,
} from '../PlaybackSessionPersistence';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

const song: Song = {
  id: 'song-1',
  title: 'A paused track',
  artist: 'Artist',
  artistId: '',
  album: 'Album',
  albumId: 'album-1',
  duration: 200,
  streamUrl: '/stream',
  artworkUrl: '/artwork',
};

describe('playback session persistence', () => {
  it('saves and restores the paused song and its exact position', () => {
    const storage = createStorage();
    expect(savePlaybackSession({
      currentSong: song,
      currentTime: 41.7,
      duration: 200,
      volume: 0.65,
      isMuted: false,
    }, storage)).toBe(true);

    const restored = loadPlaybackSession(storage);
    expect(restored).toMatchObject({
      currentSong: song,
      currentTime: 41.7,
      duration: 200,
      volume: 0.65,
      isMuted: false,
    });
    expect(restored?.savedAt).toEqual(expect.any(Number));
  });

  it('ignores corrupt or incomplete session records', () => {
    const storage = createStorage();
    storage.setItem(PLAYBACK_SESSION_STORAGE_KEY, '{broken json');
    expect(loadPlaybackSession(storage)).toBeNull();

    storage.setItem(PLAYBACK_SESSION_STORAGE_KEY, JSON.stringify({
      currentSong: song,
      currentTime: -1,
      duration: 200,
      volume: 0.5,
    }));
    expect(loadPlaybackSession(storage)).toBeNull();
  });

  it('stores no active-play intent, so restoration never auto-starts audio', () => {
    const storage = createStorage();
    savePlaybackSession({
      currentSong: song,
      currentTime: 10,
      duration: 200,
      volume: 0.85,
      isMuted: false,
    }, storage);

    const saved = JSON.parse(storage.getItem(PLAYBACK_SESSION_STORAGE_KEY)!);
    expect(saved.isPlaying).toBeUndefined();
  });
});
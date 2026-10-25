import { describe, it, expect, beforeEach } from 'vitest';
import { QueueManager } from '../QueueManager';
import { Song } from '../../types';

function createMockSong(id: string, title: string): Song {
  return {
    id,
    title,
    artist: 'Artist ' + id,
    artistId: 'artist-' + id,
    album: 'Album ' + id,
    albumId: 'album-' + id,
    duration: 180,
    streamUrl: `/api/song/${id}/audio`,
    artworkUrl: `https://example.com/${id}.jpg`,
  };
}

describe('QueueManager — Shuffle & Reshuffle Features', () => {
  let queueManager: QueueManager;
  let songs: Song[];

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    };
    queueManager = new QueueManager();
    songs = [
      createMockSong('1', 'Wattaratha Ketu Paru Nanga'),
      createMockSong('2', 'Kadhal Kan Kattudhe'),
      createMockSong('3', 'Kannala Kannala'),
      createMockSong('4', 'Kannae Kanmaniye'),
      createMockSong('5', 'Idhazhin Oram'),
      createMockSong('6', 'Naan Un'),
    ];
  });

  it('initializes context queue properly on setQueue', () => {
    const current = queueManager.setQueue(songs, 0);
    expect(current?.id).toBe('1');
    expect(queueManager.getContextQueue().length).toBe(5);
    expect(queueManager.getContextQueue().map((s) => s.id)).toEqual(['2', '3', '4', '5', '6']);
  });

  it('toggles shuffle on and alters order, and toggles shuffle off to restore original order', () => {
    queueManager.setQueue(songs, 0);
    const originalUpcomingIds = queueManager.getContextQueue().map((s) => s.id);
    expect(originalUpcomingIds).toEqual(['2', '3', '4', '5', '6']);

    const isShuffled = queueManager.toggleShuffle();
    expect(isShuffled).toBe(true);
    expect(queueManager.getShuffle()).toBe(true);

    const isShuffledOff = queueManager.toggleShuffle();
    expect(isShuffledOff).toBe(false);
    expect(queueManager.getShuffle()).toBe(false);

    // Restores original upcoming sequence
    const restoredUpcomingIds = queueManager.getContextQueue().map((s) => s.id);
    expect(restoredUpcomingIds).toEqual(originalUpcomingIds);
  });

  it('reshuffles remaining context queue tracks on demand', () => {
    queueManager.setQueue(songs, 0);
    const success = queueManager.reshuffle();
    expect(success).toBe(true);
    expect(queueManager.getContextQueue().length).toBe(5);
  });

  it('navigates to previous track from history', () => {
    queueManager.setQueue(songs, 0);
    expect(queueManager.getCurrentSong()?.id).toBe('1');
    
    // Advance to next song ('2')
    const nextSong = queueManager.next();
    expect(nextSong?.id).toBe('2');
    expect(queueManager.getCurrentSong()?.id).toBe('2');

    // Previous song should return '1'
    const prevSong = queueManager.previous();
    expect(prevSong?.id).toBe('1');
    expect(queueManager.getCurrentSong()?.id).toBe('1');
  });
});

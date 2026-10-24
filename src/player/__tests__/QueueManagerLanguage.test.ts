import { describe, expect, it } from 'vitest';
import { QueueManager } from '../QueueManager';
import { Song } from '../../types';

function track(id: string, language?: string): Song {
  return {
    id,
    title: id,
    artist: 'Artist',
    artistId: '',
    album: 'Album',
    albumId: 'album',
    duration: 180,
    streamUrl: '',
    artworkUrl: '',
    language,
  };
}

describe('QueueManager automatic queue preservation', () => {
  it('keeps manually queued tracks when a new song is explicitly played', () => {
    const queue = new QueueManager();
    queue.setQueue([track('current')]);
    queue.addToQueue(track('manual-1'));
    queue.addToQueue(track('manual-2'));

    queue.setQueue([track('cross-language', 'Bengali')], 0, true);

    expect(queue.getCurrentSong()?.id).toBe('cross-language');
    expect(queue.getUserQueue().map(({ id }) => id)).toEqual(['manual-1', 'manual-2']);
  });

  it('preserves explicit album order while automatic recommendations only replace themselves', () => {
    const queue = new QueueManager();
    queue.setQueue([track('current')]);
    queue.addToQueue(track('manual'));
    queue.setQueue([
      track('album-1', 'Tamil'),
      track('album-2', 'Tamil'),
      track('album-3', 'Tamil'),
    ], 0, true);
    queue.setAutoplayQueue([track('radio-1', 'Tamil')]);

    expect(queue.getUpcomingTracks().map(({ id }) => id)).toEqual([
      'manual', 'album-2', 'album-3', 'radio-1',
    ]);

    queue.setAutoplayQueue([track('radio-2', 'Tamil')]);
    expect(queue.getUpcomingTracks().map(({ id }) => id)).toEqual([
      'manual', 'album-2', 'album-3', 'radio-2',
    ]);
  });
});

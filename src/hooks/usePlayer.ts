import { useEffect, useState, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { backgroundAudioManager } from '../player/BackgroundAudioManager';
import { Song, PlaybackState } from '../types';

export function usePlayer() {
  const [state, setState] = useState<PlaybackState>(() => audioEngine.getState());

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const playTrack = useCallback((song: Song, contextQueue?: Song[]) => {
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    backgroundAudioManager.startPlaybackAnchor(song);
    return audioEngine.playTrack(song, contextQueue);
  }, []);

  const playQueueIndex = useCallback((idx: number) => {
    backgroundAudioManager.unlockAudioContext().catch(() => {});
    return audioEngine.playQueueIndex(idx);
  }, []);

  const loadSuggestions = useCallback((songId?: string) => {
    return audioEngine.loadSuggestions(songId);
  }, []);

  const play = useCallback(() => {
    backgroundAudioManager.startPlaybackAnchor(state.currentSong);
    return audioEngine.play();
  }, [state.currentSong]);

  const pause = useCallback(() => {
    backgroundAudioManager.stopPlaybackAnchor();
    return audioEngine.pause();
  }, []);

  const togglePlay = useCallback(() => {
    // The engine decides from the media element itself: after iOS pauses the element while
    // the app is suspended, state.isPlaying can be stale and the button would toggle into
    // a pause that does nothing until the app is reopened.
    return audioEngine.togglePlay();
  }, []);

  const seek = useCallback((time: number) => audioEngine.seek(time), []);
  const playNextTrack = useCallback(() => audioEngine.playNextTrack(), []);
  const playPreviousTrack = useCallback(() => audioEngine.playPreviousTrack(), []);
  const next = useCallback(() => audioEngine.playNextTrack(), [playNextTrack]);
  const previous = useCallback(() => audioEngine.playPreviousTrack(), [playPreviousTrack]);
  const setVolume = useCallback((vol: number) => audioEngine.setVolume(vol), []);
  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);
  const toggleShuffle = useCallback(() => audioEngine.toggleShuffle(), []);
  const reshuffle = useCallback(() => audioEngine.reshuffle(), []);
  const cycleRepeatMode = useCallback(() => audioEngine.cycleRepeatMode(), []);
  const addToQueue = useCallback((song: Song) => audioEngine.addToQueue(song), []);
  const playNext = useCallback((song: Song) => audioEngine.playNext(song), []);
  const reorderQueue = useCallback((start: number, end: number) => audioEngine.reorderQueue(start, end), []);
  const setUpcomingTracks = useCallback((upcoming: Song[]) => audioEngine.setUpcomingTracks(upcoming), []);
  const removeFromQueue = useCallback((idx: number) => audioEngine.removeFromQueue(idx), []);
  const clearQueue = useCallback(() => audioEngine.clearQueue(), []);
  const clearUpcoming = useCallback(() => audioEngine.clearUpcoming(), []);
  const clearUserQueue = useCallback(() => audioEngine.clearUserQueue(), []);
  const clearAutoplayQueue = useCallback(() => audioEngine.clearAutoplayQueue(), []);
  const setCrossfade = useCallback((seconds: number) => audioEngine.setCrossfade(seconds), []);
  const setAudioQuality = useCallback((quality: 'normal' | 'high' | 'lossless' | 'hires') => audioEngine.setAudioQuality(quality), []);
  const updateSettings = useCallback((settings: any) => audioEngine.updateSettings(settings), []);

  return {
    ...state,
    playTrack,
    playQueueIndex,
    loadSuggestions,
    play,
    pause,
    togglePlay,
    seek,
    next,
    previous,
    playNextTrack,
    playPreviousTrack,
    setVolume,
    toggleMute,
    toggleShuffle,
    reshuffle,
    cycleRepeatMode,
    addToQueue,
    playNext,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    clearUpcoming,
    clearUserQueue,
    clearAutoplayQueue,
    setCrossfade,
    setAudioQuality,
    updateSettings,
  };
}

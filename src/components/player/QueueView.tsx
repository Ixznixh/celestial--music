import React, { useState } from 'react';
import { Song, RepeatMode } from '../../types';
import { 
  X, 
  Trash2, 
  Play, 
  Pause, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Timer, 
  Menu, 
  Sparkles, 
  Loader2, 
  History, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { ArtworkImage } from '../common/ArtworkImage';
import { detectSongGenre, getGenreTheme } from '../../utils/genre';

export interface QueueViewProps {
  queue: Song[];
  queueIndex: number;
  currentSong: Song | null;
  userQueue?: Song[];
  suggestionsQueue?: Song[];
  isLoadingSuggestions?: boolean;
  onSelectTrack: (song: Song, index: number) => void;
  onRemoveTrack: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onSetUpcomingTracks?: (upcoming: Song[]) => void;
  onClearQueue: () => void;
  onClearUpcoming?: () => void;
  onClearUserQueue?: () => void;
  onClearAutoplayQueue?: () => void;
  onLoadMoreSuggestions?: () => void;
  onClose?: () => void;
  className?: string;

  // Modern Spotify Queue screenshot controls:
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  shuffle?: boolean;
  onToggleShuffle?: () => void;
  onReshuffle?: () => void;
  repeat?: RepeatMode;
  onCycleRepeat?: () => void;
  contextTitle?: string;
  sleepTimerMinutes?: number | null;
  onOpenSleepTimer?: () => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '3:30';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const QueueView: React.FC<QueueViewProps> = ({
  queue,
  queueIndex,
  currentSong,
  userQueue = [],
  suggestionsQueue = [],
  isLoadingSuggestions = false,
  onSelectTrack,
  onRemoveTrack,
  onReorder,
  onSetUpcomingTracks,
  onClearQueue,
  onClearUpcoming,
  onClearUserQueue,
  onClearAutoplayQueue,
  onLoadMoreSuggestions,
  onClose,
  className = '',
  isPlaying = false,
  onTogglePlay,
  shuffle = false,
  onToggleShuffle,
  onReshuffle,
  repeat = 'off',
  onCycleRepeat,
  contextTitle,
  sleepTimerMinutes = null,
  onOpenSleepTimer,
}) => {
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('all');

  const safeIndex = queueIndex >= 0 ? queueIndex : 0;
  const historyTracks = queue.slice(0, safeIndex);
  const upcomingTracks = queue.slice(safeIndex + 1);

  const nowPlayingGenre = currentSong ? detectSongGenre(currentSong) : 'Pop & Soundtracks';

  // Available unique genres in upcoming queue for filter pills
  const availableGenres: string[] = Array.from(new Set(upcomingTracks.map((s) => detectSongGenre(s))));

  const displayTracks = selectedGenreFilter === 'all'
    ? upcomingTracks
    : upcomingTracks.filter((s) => detectSongGenre(s) === selectedGenreFilter);

  const handleReorderUpcoming = (newUpcoming: Song[]) => {
    if (onSetUpcomingTracks) {
      onSetUpcomingTracks(newUpcoming);
    }
  };

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const displayContext = contextTitle || currentSong?.album || currentSong?.artist || 'DMK-PAYALUGA';

  return (
    <div className={`flex flex-col h-full w-full min-h-0 bg-[#181818]/94 backdrop-blur-2xl text-white select-none relative ${className}`}>
      {/* Top Drag Handle Bar (Clicking or dragging dismisses back to artwork) */}
      <div 
        className="w-full flex items-center justify-center pt-2.5 pb-2 cursor-pointer shrink-0 touch-none group"
        onClick={onClose}
        title="Swipe down to dismiss"
      >
        <div className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
      </div>

      {/* Header: Title + Context Info & Edit Mode Toggle */}
      <div className="flex items-center justify-between px-5 pt-0.5 pb-3 shrink-0 border-b border-white/5">
        <div className="min-w-0 pr-3">
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Queue</h2>
          <p className="text-xs text-neutral-400 font-medium truncate mt-0.5">
            Playing {displayContext}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onLoadMoreSuggestions && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onLoadMoreSuggestions}
              disabled={isLoadingSuggestions}
              title="Add more songs"
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              {isLoadingSuggestions ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </motion.button>
          )}

          <button
            onClick={() => {
              triggerHaptic();
              setIsEditMode(!isEditMode);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              isEditMode 
                ? 'bg-white text-black shadow-md' 
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/5'
            }`}
          >
            {isEditMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Optional Genre Filter Bar (when edit mode is off and multiple genres exist) */}
      {!isEditMode && availableGenres.length > 2 && (
        <div className="flex items-center gap-1.5 px-5 py-2 bg-black/30 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1 shrink-0 mr-1">
            <SlidersHorizontal className="w-3 h-3" />
            Genre:
          </span>
          <button
            onClick={() => setSelectedGenreFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedGenreFilter === 'all'
                ? 'bg-white text-black font-bold shadow'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            All ({upcomingTracks.length})
          </button>
          {availableGenres.map((genre) => {
            const isSelected = selectedGenreFilter === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenreFilter(isSelected ? 'all' : genre)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#1ed760] text-black font-bold shadow-sm'
                    : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable Track List Container */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 overscroll-contain no-scrollbar">
        {/* Current Playing Track (Spotify Green Highlight & White Circle Play Button) */}
        {currentSong && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] transition group mb-1">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
              <ArtworkImage
                src={currentSong.artworkUrl}
                alt={currentSong.title}
                size="small"
                className="w-12 h-12 rounded-lg shrink-0 shadow-md border border-white/10 object-cover"
                fallbackVideoId={currentSong.id}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3 px-0.5 shrink-0">
                      {[0.3, 0.9, 0.6].map((_, idx) => (
                        <motion.span
                          key={idx}
                          className="w-0.5 bg-[#1ed760] rounded-full"
                          animate={{ height: ['20%', '100%', '35%', '90%', '20%'] }}
                          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay: idx * 0.15 }}
                          style={{ minHeight: '3px' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#1ed760] font-bold text-xs shrink-0">•</span>
                  )}
                  <p className="text-sm font-semibold text-[#1ed760] truncate leading-tight">
                    {currentSong.title}
                  </p>
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5 pl-0.5">
                  {currentSong.artist}
                </p>
              </div>
            </div>

            {/* Circular White Play/Pause Button */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic();
                onTogglePlay?.();
              }}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg hover:bg-neutral-200 transition cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4.5 h-4.5 fill-current" />
              ) : (
                <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
              )}
            </motion.button>
          </div>
        )}

        {/* Edit Mode Bulk Actions */}
        {isEditMode && upcomingTracks.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-neutral-900/60 rounded-xl border border-white/5 mb-2">
            <span className="text-xs text-neutral-400">
              {upcomingTracks.length} upcoming track{upcomingTracks.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => {
                triggerHaptic();
                onClearUpcoming ? onClearUpcoming() : onClearQueue();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Upcoming</span>
            </button>
          </div>
        )}

        {/* Upcoming List with Drag Reordering */}
        {displayTracks.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 my-4">
            <Sparkles className="w-7 h-7 text-[#1ed760] mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-semibold text-white">Queue is empty</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
              Add songs from any playlist or fetch dynamic recommendations.
            </p>
            {onLoadMoreSuggestions && (
              <button
                onClick={onLoadMoreSuggestions}
                disabled={isLoadingSuggestions}
                className="mt-3 px-4 py-2 rounded-full bg-[#1ed760] text-black text-xs font-bold transition hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
              >
                Fetch Recommendations
              </button>
            )}
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={upcomingTracks}
            onReorder={handleReorderUpcoming}
            className="space-y-1"
          >
            {displayTracks.map((song, i) => {
              const effectiveIdx = safeIndex + 1 + i;
              return (
                <Reorder.Item
                  key={song.id}
                  value={song}
                  onDragStart={triggerHaptic}
                  whileDrag={{
                    scale: 1.02,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                  className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.08] transition cursor-pointer select-none"
                  onClick={() => onSelectTrack(song, effectiveIdx)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <ArtworkImage
                      src={song.artworkUrl}
                      alt={song.title}
                      size="small"
                      className="w-12 h-12 rounded-lg shrink-0 shadow-sm border border-white/5 object-cover bg-neutral-900"
                      fallbackVideoId={song.id}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white group-hover:text-neutral-100 transition truncate leading-tight">
                        {song.title}
                      </p>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {song.artist}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Reorder 3-bar icon or Delete button in edit mode */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditMode ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          onRemoveTrack(effectiveIdx);
                        }}
                        className="p-2 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title="Remove track"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div 
                        className="p-2 text-neutral-400 hover:text-white transition cursor-grab active:cursor-grabbing touch-none"
                        title="Drag to reorder"
                      >
                        <Menu className="w-5 h-5 stroke-[2.2]" />
                      </div>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}

        {/* Previously Played History (Collapsible) */}
        {historyTracks.length > 0 && (
          <div className="pt-3 pb-1 border-t border-white/5 mt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between py-1 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>Previously Played ({historyTracks.length})</span>
              </div>
              {showHistory ? (
                <ChevronUp className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              )}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1 pt-2 overflow-hidden"
                >
                  {historyTracks.map((song, i) => (
                    <div
                      key={`hist-${song.id}-${i}`}
                      onClick={() => onSelectTrack(song, i)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition cursor-pointer opacity-70 hover:opacity-100"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <ArtworkImage
                          src={song.artworkUrl}
                          alt={song.title}
                          size="small"
                          className="w-10 h-10 rounded-lg shrink-0 object-cover opacity-80"
                          fallbackVideoId={song.id}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">{song.title}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {formatDuration(song.duration)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Bottom padding to scroll clear of floating reshuffle & dock */}
        <div className="h-28 shrink-0" />
      </div>

      {/* Floating Centered Reshuffle Button Pill */}
      {upcomingTracks.length > 1 && (
        <div className="absolute bottom-[86px] inset-x-0 flex justify-center pointer-events-none z-30">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic();
              onReshuffle?.();
            }}
            className="pointer-events-auto px-5 py-2 rounded-full bg-[#2a2a2a]/95 hover:bg-[#383838] active:scale-95 text-white text-xs font-semibold border border-white/15 shadow-2xl transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
          >
            <span>Reshuffle</span>
          </motion.button>
        </div>
      )}

      {/* Segmented Bottom Dock Toolbar: Shuffle | Repeat | Timer */}
      <div className="px-4 pb-4 pt-1 shrink-0 z-20">
        <div className="bg-[#222222]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 grid grid-cols-3 gap-1 shadow-2xl">
          {/* Shuffle */}
          <button
            onClick={() => {
              triggerHaptic();
              onToggleShuffle?.();
            }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
              shuffle ? 'text-[#1ed760]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5 stroke-[2.2]" />
            <span className={`text-[11px] font-medium mt-1 ${shuffle ? 'text-[#1ed760] font-semibold' : 'text-neutral-400'}`}>
              Shuffle
            </span>
          </button>

          {/* Repeat */}
          <button
            onClick={() => {
              triggerHaptic();
              onCycleRepeat?.();
            }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
              repeat && repeat !== 'off' ? 'text-[#1ed760]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {repeat === 'one' ? (
              <Repeat1 className="w-5 h-5 stroke-[2.4]" />
            ) : (
              <Repeat className="w-5 h-5 stroke-[2.2]" />
            )}
            <span className={`text-[11px] font-medium mt-1 ${repeat && repeat !== 'off' ? 'text-[#1ed760] font-semibold' : 'text-neutral-400'}`}>
              Repeat
            </span>
          </button>

          {/* Timer */}
          <button
            onClick={() => {
              triggerHaptic();
              onOpenSleepTimer?.();
            }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
              sleepTimerMinutes !== null ? 'text-[#1ed760]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Timer className="w-5 h-5 stroke-[2.2]" />
            <span className={`text-[11px] font-medium mt-1 ${sleepTimerMinutes !== null ? 'text-[#1ed760] font-semibold' : 'text-neutral-400'}`}>
              {sleepTimerMinutes !== null ? `${sleepTimerMinutes}m` : 'Timer'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

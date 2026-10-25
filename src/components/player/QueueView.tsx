import React, { useState } from 'react';
import { Song } from '../../types';
import { 
  X, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Loader2, 
  History, 
  ChevronDown, 
  ChevronUp,
  Music2,
  ListPlus,
  RefreshCw,
  Play,
  HardDrive,
  GripVertical,
  Radio,
  SlidersHorizontal,
  Flame,
  Music
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
}) => {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('all');

  // Spotify-style Queue Partitioning:
  // - History: tracks played before current index
  // - Now Playing: current track with genre badge
  // - User Queue: explicitly queued tracks ("Add to queue" / "Play Next")
  // - Radio / Autoplay Queue: genre-matched continuous queue
  const safeIndex = queueIndex >= 0 ? queueIndex : 0;
  const historyTracks = queue.slice(0, safeIndex);
  const upcomingTracks = queue.slice(safeIndex + 1);
  const totalUpcoming = upcomingTracks.length;

  const nowPlayingGenre = currentSong ? detectSongGenre(currentSong) : 'Pop & Soundtracks';
  const nowPlayingTheme = getGenreTheme(nowPlayingGenre);

  // Differentiate user-added queue from Spotify-style radio suggestions
  const hasUserQueue = Array.isArray(userQueue) && userQueue.length > 0;
  const userQueueIds = new Set(userQueue.map((s) => s.id));
  
  const userUpcoming = hasUserQueue
    ? upcomingTracks.filter((s) => userQueueIds.has(s.id))
    : [];
  const radioUpcoming = hasUserQueue
    ? upcomingTracks.filter((s) => !userQueueIds.has(s.id))
    : upcomingTracks;

  // Filter radio tracks by genre if a genre chip is selected
  const displayRadioTracks = selectedGenreFilter === 'all'
    ? radioUpcoming
    : radioUpcoming.filter((s) => detectSongGenre(s) === selectedGenreFilter);

  // Available unique genres in upcoming queue for filter pills
  const availableGenres: string[] = Array.from(new Set(upcomingTracks.map((s) => detectSongGenre(s))));

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

  return (
    <div className={`flex flex-col h-full w-full min-h-0 text-white select-none ${className}`}>
      {/* Sticky Header inside Queue View */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 bg-[#0a0a0c] border-b border-white/10 shrink-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 truncate">
            <span>Queue</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
              Spotify Mode
            </span>
          </h3>
          <span className="text-xs font-medium text-neutral-400 truncate">
            • {totalUpcoming} track{totalUpcoming === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Refresh Suggestions Button */}
          {onLoadMoreSuggestions && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              onClick={onLoadMoreSuggestions}
              disabled={isLoadingSuggestions}
              title="Add more genre-matched tracks"
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-rose-300 font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isLoadingSuggestions ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="hidden sm:inline">Add More</span>
            </motion.button>
          )}

          {/* Clear Button */}
          {totalUpcoming > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              onClick={onClearUpcoming || onClearQueue}
              title="Clear upcoming queue"
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-xs font-medium text-neutral-300 hover:text-rose-300 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </motion.button>
          )}

          {/* Close / Return Button */}
          {onClose && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.08 }}
              onClick={onClose}
              aria-label="Close Queue"
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition ml-0.5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Spotify-style Genre & Mood Filter Bar */}
      {availableGenres.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2 bg-black/60 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0 text-xs">
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
            All Tracks ({totalUpcoming})
          </button>

          {availableGenres.map((genre) => {
            const theme = getGenreTheme(genre);
            const isSelected = selectedGenreFilter === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenreFilter(isSelected ? 'all' : genre)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? `${theme.bg} ${theme.color} ${theme.border} font-bold shadow-sm`
                    : 'bg-white/5 text-neutral-400 hover:text-white border-transparent hover:bg-white/10'
                }`}
              >
                <span>{theme.emoji}</span>
                <span>{genre}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 overscroll-contain">
        {/* 1. NOW PLAYING CARD WITH GENRE BADGE */}
        {currentSong && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5" />
                Now Playing
              </span>

              {/* Genre badge pill */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${nowPlayingTheme.bg} ${nowPlayingTheme.color} ${nowPlayingTheme.border} flex items-center gap-1 shadow-sm`}>
                <span>{nowPlayingTheme.emoji}</span>
                <span>{nowPlayingGenre}</span>
              </span>
            </div>

            <motion.div
              layout
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-neutral-900/90 to-neutral-900/90 border border-rose-500/30 flex items-center gap-3.5 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute -left-10 -top-10 w-24 h-24 bg-rose-500/10 rounded-full pointer-events-none" />

              <ArtworkImage
                src={currentSong.artworkUrl}
                alt={currentSong.title}
                size="small"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl shrink-0 shadow-lg border border-white/10"
                fallbackVideoId={currentSong.id}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-xs sm:text-sm text-neutral-300 truncate mt-0.5">
                  {currentSong.artist}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {formatDuration(currentSong.duration)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium">
                    <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    Spotify Song Radio
                  </span>
                </div>
              </div>

              {/* Animated Equalizer */}
              <div className="flex items-end gap-1 h-5 px-2 shrink-0">
                {[0.3, 0.8, 0.5, 0.9].map((_, idx) => (
                  <motion.span
                    key={idx}
                    className="w-1 bg-rose-500 rounded-full"
                    animate={{
                      height: ['20%', '100%', '40%', '85%', '20%'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.1,
                      ease: 'easeInOut',
                      delay: idx * 0.18,
                    }}
                    style={{ minHeight: '4px' }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Suggestions Loading Notification */}
        <AnimatePresence>
          {isLoadingSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
            >
              <Loader2 className="w-4 h-4 animate-spin text-rose-400 shrink-0" />
              <span>Fetching genre-matched tracks for {nowPlayingGenre}...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. NEXT IN QUEUE (USER QUEUED TRACKS) */}
        {userUpcoming.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <ListPlus className="w-3.5 h-3.5" />
                Next In Queue ({userUpcoming.length})
              </span>
              {onClearUserQueue && (
                <button
                  onClick={onClearUserQueue}
                  className="text-[11px] text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {userUpcoming.map((song, i) => {
                const genre = detectSongGenre(song);
                const theme = getGenreTheme(genre);
                return (
                  <div
                    key={`user-${song.id}-${i}`}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition group"
                  >
                    <button
                      onClick={() => onSelectTrack(song, safeIndex + 1 + i)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <ArtworkImage
                        src={song.artworkUrl}
                        alt={song.title}
                        size="small"
                        className="w-10 h-10 rounded-lg shrink-0 border border-white/10"
                        fallbackVideoId={song.id}
                      />
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{song.artist}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${theme.bg} ${theme.color} ${theme.border} shrink-0 hidden sm:inline`}>
                        {theme.emoji} {genre}
                      </span>
                    </button>
                    <button
                      onClick={() => onRemoveTrack(safeIndex + 1 + i)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 transition cursor-pointer"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. NEXT FROM SONG RADIO (GENRE & MOOD MATCHED QUEUE) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                {currentSong ? `Next from: ${currentSong.artist} Radio` : 'Up Next'}
              </span>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Playing songs with matching genre ({nowPlayingGenre})
              </p>
            </div>
          </div>

          {displayRadioTracks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10 px-4 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40"
            >
              <Sparkles className="w-8 h-8 text-rose-400/70 mx-auto mb-2.5 animate-pulse" />
              <p className="text-sm font-semibold text-neutral-200">No tracks match "{selectedGenreFilter}"</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                Select "All Tracks" or tap below to fetch more recommendations.
              </p>
              {onLoadMoreSuggestions && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={onLoadMoreSuggestions}
                  disabled={isLoadingSuggestions}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fetch New Songs</span>
                </motion.button>
              )}
            </motion.div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={upcomingTracks} 
              onReorder={handleReorderUpcoming}
              className="space-y-1.5"
            >
              {displayRadioTracks.map((song, i) => {
                const effectiveIdx = safeIndex + 1 + i;
                const genre = detectSongGenre(song);
                const theme = getGenreTheme(genre);

                return (
                  <Reorder.Item
                    key={song.id}
                    value={song}
                    onDragStart={triggerHaptic}
                    whileDrag={{ 
                      scale: 1.02, 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                      backgroundColor: 'rgba(255,255,255,0.12)' 
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                    className="group flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 active:bg-white/15 transition border border-white/5 cursor-grab active:cursor-grabbing select-none"
                  >
                    <button
                      onClick={() => onSelectTrack(song, effectiveIdx)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-rose-400 w-5 text-center shrink-0">
                        {i + 1}
                      </span>
                      <ArtworkImage
                        src={song.artworkUrl}
                        alt={song.title}
                        size="small"
                        className="w-11 h-11 rounded-lg shrink-0 shadow-sm border border-white/10"
                        fallbackVideoId={song.id}
                      />
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-white group-hover:text-rose-400 transition truncate">
                            {song.title}
                          </p>
                          {i === 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium shrink-0">
                              <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
                              Next Cached
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-neutral-400 truncate">
                            {song.artist}
                          </p>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md border ${theme.bg} ${theme.color} ${theme.border} shrink-0`}>
                            {theme.emoji} {genre}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-500 shrink-0 mr-2 hidden sm:inline font-mono">
                        {formatDuration(song.duration)}
                      </span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                      {i > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.82 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(effectiveIdx, effectiveIdx - 1);
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      {i < upcomingTracks.length - 1 && (
                        <motion.button
                          whileTap={{ scale: 0.82 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(effectiveIdx, effectiveIdx + 1);
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.82 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrack(effectiveIdx);
                        }}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove from queue"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>

                      {/* Touch & mouse Drag Reorder Handle */}
                      <div 
                        className="p-1.5 text-neutral-500 group-hover:text-neutral-300 hover:text-white transition cursor-grab active:cursor-grabbing touch-none"
                        title="Drag to reorder track position"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </div>

        {/* 4. SPOTIFY CONTINUOUS SONG RADIO FOOTER */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Continuous Song Radio Active</p>
              <p className="text-[11px] text-neutral-400">
                Automatically queueing songs matching {nowPlayingGenre}
              </p>
            </div>
          </div>

          {onLoadMoreSuggestions && (
            <button
              onClick={onLoadMoreSuggestions}
              disabled={isLoadingSuggestions}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition cursor-pointer shrink-0"
            >
              Load More
            </button>
          )}
        </div>

        {/* 5. PREVIOUSLY PLAYED (Collapsible) */}
        {historyTracks.length > 0 && (
          <div className="pt-3 border-t border-white/5">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition"
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
            </motion.button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 mt-2 opacity-80 overflow-hidden"
                >
                  {historyTracks.map((song, histIdx) => (
                    <motion.div
                      key={`hist-${song.id}-${histIdx}`}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
                      onClick={() => onSelectTrack(song, histIdx)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ArtworkImage
                          src={song.artworkUrl}
                          alt={song.title}
                          size="small"
                          className="w-9 h-9 rounded-md shrink-0 opacity-80"
                          fallbackVideoId={song.id}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-300 truncate">
                            {song.title}
                          </p>
                          <p className="text-[10px] text-neutral-500 truncate">
                            {song.artist}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-rose-400 hover:underline flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" />
                        Replay
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

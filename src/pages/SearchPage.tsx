import React, { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import { SearchResults, Song, Album, Artist, Playlist, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { db } from '../services/indexedDB';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { formatTime } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { MUSIC_LANGUAGES, normalizeMusicLanguage, rankSearchSongs } from '../utils/musicLanguage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Clock, 
  Play, 
  MoreHorizontal, 
  Sparkles, 
  Disc, 
  User, 
  ListMusic, 
  Music 
} from 'lucide-react';

interface SearchPageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onOpenContextMenu: (song: Song) => void;
  autoFocus?: boolean;
  musicLanguage?: string;
}

const RECENT_SEARCHES_KEY = 'celestial_recent_searches';

const loadRecentSearchesFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2);
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const saveRecentSearchesToStorage = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export const SearchPage: React.FC<SearchPageProps> = ({
  onNavigate,
  onPlaySong,
  onOpenContextMenu,
  autoFocus = false,
  musicLanguage,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists'>('all');
  const [results, setResults] = useState<SearchResults>({ songs: [], artists: [], albums: [], playlists: [] });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearchesFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSuggestionsDismissed, setIsSuggestionsDismissed] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [discoveryResults, setDiscoveryResults] = useState<SearchResults>({
    songs: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [, startTransition] = useTransition();

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const suggestionId = 'search-autocomplete-list';

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  // Focus search input when requested via double-tap or autoFocus prop
  useEffect(() => {
    const focusInput = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        if (searchInputRef.current.value) {
          searchInputRef.current.setSelectionRange(
            searchInputRef.current.value.length,
            searchInputRef.current.value.length
          );
        }
      }
    };

    if (autoFocus) {
      focusInput();
      const t1 = setTimeout(focusInput, 50);
      const t2 = setTimeout(focusInput, 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    const handleFocusSearch = () => {
      focusInput();
      setTimeout(focusInput, 50);
    };

    window.addEventListener('celestial:focus-search', handleFocusSearch);
    return () => window.removeEventListener('celestial:focus-search', handleFocusSearch);
  }, [autoFocus]);

  // Load recent searches from localStorage on mount & sync with IndexedDB fallback
  useEffect(() => {
    const stored = loadRecentSearchesFromStorage();
    if (stored.length > 0) {
      setRecentSearches(stored);
    } else {
      db.getSetting<string[]>('recent_searches', []).then((list) => {
        if (list && list.length > 0) {
          const cleaned: string[] = [];
          for (const item of list) {
            const norm = item.toLowerCase().trim();
            if (!norm || norm.length < 2) continue;
            if (!cleaned.some((existing) => existing.toLowerCase() === norm)) {
              cleaned.push(item);
            }
          }
          const final = cleaned.slice(0, 8);
          setRecentSearches(final);
          saveRecentSearchesToStorage(final);
        }
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const languageName = MUSIC_LANGUAGES.find(({ code }) => code === musicLanguage)?.label;
    setDiscoveryLoading(true);
    providerManager.search(languageName ? `${languageName} songs` : 'trending music', undefined, {
      signal: controller.signal,
    }).then((data) => {
      if (controller.signal.aborted) return;
      setDiscoveryResults({
        ...data,
        songs: musicLanguage && musicLanguage !== 'all'
          ? data.songs.filter((song) => normalizeMusicLanguage(song.language) === normalizeMusicLanguage(musicLanguage))
          : data.songs,
        artists: musicLanguage && musicLanguage !== 'all' ? [] : data.artists,
        albums: musicLanguage && musicLanguage !== 'all' ? [] : data.albums,
        playlists: musicLanguage && musicLanguage !== 'all' ? [] : data.playlists,
      });
    }).catch((err: Error) => {
      if (!controller.signal.aborted) console.warn('Could not load search discovery suggestions:', err);
    }).finally(() => {
      if (!controller.signal.aborted) setDiscoveryLoading(false);
    });
    return () => controller.abort();
  }, [musicLanguage]);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const norm = trimmed.toLowerCase();
      // Filter out exact duplicates AND substring clutter
      const filtered = prev.filter((item) => {
        const itemNorm = item.toLowerCase();
        if (itemNorm === norm) return false;
        return true;
      });
      const updated = [trimmed, ...filtered].slice(0, 8);
      saveRecentSearchesToStorage(updated);
      db.saveSetting('recent_searches', updated);
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    saveRecentSearchesToStorage([]);
    db.saveSetting('recent_searches', []);
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((t) => t !== term);
      saveRecentSearchesToStorage(updated);
      db.saveSetting('recent_searches', updated);
      return updated;
    });
  };

  const autocomplete = useMemo(() => {
    const entries = [
      ...results.songs.slice(0, 5).map((item) => ({ kind: 'song' as const, item, title: item.title, detail: item.artist })),
      ...results.artists.slice(0, 3).map((item) => ({ kind: 'artist' as const, item, title: item.name, detail: item.genre || 'Artist' })),
      ...results.albums.slice(0, 3).map((item) => ({ kind: 'album' as const, item, title: item.title, detail: item.artist })),
      ...results.playlists.slice(0, 3).map((item) => ({ kind: 'playlist' as const, item, title: item.title, detail: `${item.trackCount} tracks` })),
    ];
    const term = query.trim().toLocaleLowerCase();
    return entries.sort((a, b) => {
      const score = (entry: typeof entries[number]) => {
        const title = entry.title.toLocaleLowerCase();
        const detail = entry.detail.toLocaleLowerCase();
        let value = title === term ? 100 : title.startsWith(term) ? 60 : title.includes(term) ? 30 : 0;
        if (detail === term) value += 45;
        if (entry.kind === 'song' && musicLanguage && musicLanguage !== 'all' &&
            normalizeMusicLanguage(entry.item.language) === normalizeMusicLanguage(musicLanguage)) value += 25;
        if (entry.kind === 'song') value += Math.min(10, Math.log10((entry.item.plays || 0) + 1));
        return value;
      };
      return score(b) - score(a);
    }).slice(0, 8);
  }, [results, query, musicLanguage]);

  const chooseSuggestion = useCallback((index: number) => {
    const suggestion = autocomplete[index];
    if (!suggestion) return;
    saveRecentSearch(query);
    setIsSuggestionsDismissed(true);
    setActiveSuggestionIndex(-1);
    if (suggestion.kind === 'artist') {
      onNavigate({ type: 'artist', artistId: suggestion.item.id });
    } else if (suggestion.kind === 'album') {
      onNavigate({ type: 'album', albumId: suggestion.item.id });
    } else if (suggestion.kind === 'playlist') {
      onNavigate({ type: 'playlist', playlistId: suggestion.item.id });
    } else {
      setQuery(suggestion.item.title);
      setFilter('songs');
    }
  }, [autocomplete, onNavigate, query]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ songs: [], artists: [], albums: [], playlists: [] });
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let isCancelled = false;
    const controller = new AbortController();
    const delayMs = retryTrigger > 0 ? 0 : 250;
    const timer = setTimeout(async () => {
      try {
        const provider = providerManager.getActiveProvider();
        const res = await provider.search(trimmed, filter, { signal: controller.signal });
        if (!isCancelled) {
          res.songs = rankSearchSongs(res.songs, trimmed, musicLanguage);
          startTransition(() => {
            setResults(res);
            setIsLoading(false);
          });
        }
      } catch (err: any) {
        if (!isCancelled) {
          // If aborted, ignore
          if (err.name === 'AbortError') return;
          console.error('Search error:', err);
          setError('Music service is temporarily unavailable.');
          setIsLoading(false);
        }
      }
    }, delayMs);

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, filter, retryTrigger, musicLanguage]);

  const hasResults =
    results.songs.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0;
  const topNonSong = results.artists[0]
    ? { kind: 'artist' as const, item: results.artists[0] }
    : results.albums[0]
      ? { kind: 'album' as const, item: results.albums[0] }
      : results.playlists[0]
        ? { kind: 'playlist' as const, item: results.playlists[0] }
        : null;

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 pb-36 md:pb-28"
    >
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Search</h2>
      </div>

      {/* Compact Search Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            if (!isSuggestionsDismissed && activeSuggestionIndex >= 0) {
              chooseSuggestion(activeSuggestionIndex);
            } else {
              saveRecentSearch(query);
              setIsSuggestionsDismissed(true);
            }
          }
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          id="search-input-field"
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsSuggestionsDismissed(false);
            setActiveSuggestionIndex(-1);
          }}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && autocomplete.length > 0) {
              event.preventDefault();
              setActiveSuggestionIndex((index) => (index + 1) % autocomplete.length);
            } else if (event.key === 'ArrowUp' && autocomplete.length > 0) {
              event.preventDefault();
              setActiveSuggestionIndex((index) => index <= 0 ? autocomplete.length - 1 : index - 1);
            } else if (event.key === 'Escape') {
              setIsSuggestionsDismissed(true);
              setActiveSuggestionIndex(-1);
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(query.trim() && isSearchFocused && !isSuggestionsDismissed && autocomplete.length)}
          aria-controls={suggestionId}
          aria-activedescendant={activeSuggestionIndex >= 0 ? `search-suggestion-${activeSuggestionIndex}` : undefined}
          placeholder="Artists, Songs, Lyrics, and More"
          className="w-full pl-10 pr-9 py-2 rounded-xl bg-neutral-850/90 hover:bg-neutral-800/90 border border-neutral-750/70 text-white placeholder-neutral-400 text-xs focus:outline-none focus:border-rose-500/80 focus-visible:ring-2 focus-visible:ring-rose-500/50 transition shadow-inner"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {query.trim() && isSearchFocused && !isSuggestionsDismissed && autocomplete.length > 0 && (
        <div id={suggestionId} role="listbox" aria-label="Search suggestions" className="relative z-20 -mt-5 rounded-xl border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden">
          {autocomplete.map((suggestion, index) => {
            const image = 'avatarUrl' in suggestion.item
              ? suggestion.item.avatarUrl
              : suggestion.item.artworkUrl || '';
            return (
              <button
                key={`${suggestion.kind}:${suggestion.item.id}`}
                id={`search-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeSuggestionIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(index)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 ${
                  index === activeSuggestionIndex ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                }`}
              >
                <ArtworkImage src={image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{suggestion.title}</span>
                  <span className="block truncate text-[11px] text-neutral-400">{suggestion.kind} · {suggestion.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category filter pills (when query is entered) */}
      {query.trim() && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(['all', 'songs', 'artists', 'albums', 'playlists'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize whitespace-nowrap transition-all ${
                filter === cat
                  ? 'bg-rose-600 text-white font-semibold shadow'
                  : 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-neutral-500 space-y-2">
          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Searching global catalog…</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-sm flex items-center justify-between">
          <span className="truncate mr-2">{error}</span>
          <button
            onClick={() => setRetryTrigger((prev) => prev + 1)}
            className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition active:scale-95 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty query state: Clean Recent Searches */}
      {!query.trim() && (
        <div className="space-y-4 pt-1">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Browse {MUSIC_LANGUAGES.find(({ code }) => code === musicLanguage)?.label || (musicLanguage === 'all' ? 'all languages' : 'music')}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['songs', 'artists', 'albums', 'playlists'] as const).map((category) => {
                const languageName = MUSIC_LANGUAGES.find(({ code }) => code === musicLanguage)?.label;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setFilter(category);
                      setQuery(languageName ? `${languageName} ${category}` : category === 'songs' ? 'trending music' : category);
                      setIsSuggestionsDismissed(false);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs capitalize text-neutral-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            {musicLanguage && musicLanguage !== 'all' && (
              <p className="mt-2 text-[11px] text-neutral-500">
                Suggested tracks are shown only when the provider confirms their language. Search remains open to every language.
              </p>
            )}
          </div>

          {discoveryLoading && (
            <p className="text-[11px] text-neutral-500">Loading live catalog suggestions…</p>
          )}

          {discoveryResults.artists.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Suggested artists</span>
              <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar">
                {discoveryResults.artists.slice(0, 8).map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                    className="w-20 shrink-0 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-xl"
                  >
                    <ArtworkImage src={artist.avatarUrl} alt="" aspectRatio="avatar" className="mx-auto h-16 w-16 rounded-full" />
                    <span className="mt-1 block truncate text-[11px] text-neutral-200">{artist.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {discoveryResults.songs.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Suggested songs</span>
              <div className="mt-2 divide-y divide-neutral-800/70 overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-900/60">
                {discoveryResults.songs.slice(0, 5).map((song) => (
                  <div key={song.id} className="flex items-center gap-2.5 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(song.title);
                        setFilter('songs');
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <ArtworkImage src={song.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded-md" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-white">{song.title}</span>
                        <span className="block truncate text-[11px] text-neutral-400">{song.artist}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Play ${song.title}`}
                      onClick={() => onPlaySong(song, discoveryResults.songs)}
                      className="rounded-full p-2 text-neutral-300 hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!discoveryLoading && musicLanguage && musicLanguage !== 'all' &&
            discoveryResults.artists.length === 0 && discoveryResults.songs.length === 0 && (
              <p className="text-xs text-neutral-500">
                The provider has no verified artist or song-language metadata for these suggestions. Search results remain available for any language.
              </p>
            )}

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-neutral-800/70 bg-neutral-900/80 rounded-xl border border-neutral-800/80 overflow-hidden">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="flex items-center justify-between px-3 py-2 hover:bg-neutral-800/80 transition group cursor-pointer"
                    onClick={() => {
                      setQuery(term);
                      saveRecentSearch(term);
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                      <span className="text-sm text-neutral-200 font-medium truncate">{term}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from search history`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="text-neutral-500 hover:text-rose-400 p-1 transition rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Search results */}
      {query.trim() && !isLoading && !hasResults && !error && (
        <div className="py-16 text-center text-neutral-400">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
          <p className="font-semibold text-white">No Results Found</p>
          <p className="text-xs text-neutral-500 mt-1">
            Check the spelling or try searching for another artist or track title.
          </p>
        </div>
      )}

      {/* Categorized Results */}
      {query.trim() && !isLoading && hasResults && (
        <div className="space-y-6">
          {/* Top Result Card (Spotify Style) */}
          {filter === 'all' && results.songs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Top Result
              </h3>
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="relative p-3.5 sm:p-4 rounded-2xl bg-neutral-850 hover:bg-neutral-800 border border-neutral-750/90 hover:border-neutral-700 transition-all shadow-xl flex items-center justify-between gap-3 sm:gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <ArtworkImage
                      src={results.songs[0].artworkUrl}
                      fallbackVideoId={results.songs[0].id}
                      alt={results.songs[0].title}
                      rounded="rounded-xl"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shadow-xl object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Song
                      </span>
                      <span className="text-xs text-neutral-400 font-medium truncate">
                        {results.songs[0].artist}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-white truncate leading-snug group-hover:text-rose-400 transition-colors">
                      {results.songs[0].title}
                    </h4>

                    {results.songs[0].album && results.songs[0].album !== 'Single' && (
                      <p className="text-xs text-neutral-500 truncate">
                        {results.songs[0].album}
                      </p>
                    )}

                    {filter === 'all' && results.songs.length === 0 && topNonSong && (
                      <div>
                        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400">
                          <Sparkles className="h-3.5 w-3.5 text-rose-500" /> Top Result
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            if (topNonSong.kind === 'artist') onNavigate({ type: 'artist', artistId: topNonSong.item.id });
                            else if (topNonSong.kind === 'album') onNavigate({ type: 'album', albumId: topNonSong.item.id });
                            else onNavigate({ type: 'playlist', playlistId: topNonSong.item.id });
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl border border-neutral-750/90 bg-neutral-850 p-3.5 text-left transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <ArtworkImage
                            src={'avatarUrl' in topNonSong.item ? topNonSong.item.avatarUrl : topNonSong.item.artworkUrl || ''}
                            alt=""
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-300">{topNonSong.kind}</span>
                            <span className="block truncate font-bold text-white">
                              {'name' in topNonSong.item ? topNonSong.item.name : topNonSong.item.title}
                            </span>
                            <span className="block truncate text-xs text-neutral-400">
                              {'genre' in topNonSong.item ? topNonSong.item.genre : 'artist' in topNonSong.item ? topNonSong.item.artist : `${topNonSong.item.trackCount} tracks`}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-rose-300">Open</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenContextMenu(results.songs[0]);
                    }}
                    className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-750 transition"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    aria-label={`Play ${results.songs[0].title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySong(results.songs[0], results.songs);
                    }}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 group-hover:scale-105 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Songs List */}
          {results.songs.length > 0 && (filter === 'all' || filter === 'songs') && (
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-rose-500" /> {filter === 'all' ? 'Songs' : 'All Songs'}
              </h3>
              <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-xl border border-neutral-800/80 overflow-hidden">
                {(filter === 'all' ? results.songs.slice(1) : results.songs).map((song) => (
                  <motion.div
                    key={song.id}
                    {...getHandlers(song)}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-between p-2.5 pr-3 hover:bg-neutral-800/70 active:bg-neutral-800 transition group cursor-pointer"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(song.title);
                        setFilter('songs');
                        setIsSuggestionsDismissed(true);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={song.artworkUrl}
                        fallbackVideoId={song.id}
                        alt={song.title}
                        rounded="rounded-md"
                        className="w-11 h-11 rounded-md shrink-0 shadow-sm"
                      />
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-rose-400 transition-colors">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5 leading-tight">
                          Song • {song.artist}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {formatTime(song.duration)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Play ${song.title}`}
                        onClick={() => onPlaySong(song, results.songs)}
                        className="rounded-full p-1.5 text-neutral-300 hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                      <button
                        type="button"
                        aria-label={`More actions for ${song.title}`}
                        onClick={() => onOpenContextMenu(song)}
                        className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Artists */}
          {results.artists.length > 0 && (filter === 'all' || filter === 'artists') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-rose-500" /> Artists
              </h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {results.artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                    className="w-28 shrink-0 text-center cursor-pointer group active:scale-95 transition"
                  >
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-md mb-2 border border-white/10">
                      <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full" />
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{artist.name}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{artist.genre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (filter === 'all' || filter === 'albums') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Disc className="w-4 h-4 text-rose-500" /> Albums
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {results.albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                    className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                  >
                    <ArtworkImage src={album.artworkUrl} alt={album.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
                    <p className="text-xs font-semibold text-white truncate">{album.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{album.artist} • {album.releaseYear}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {results.playlists.length > 0 && (filter === 'all' || filter === 'playlists') && (
            <div>
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ListMusic className="w-4 h-4 text-rose-500" /> Playlists
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {results.playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => onNavigate({ type: 'playlist', playlistId: playlist.id })}
                    className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                  >
                    <PlaylistThumbnail
                      artworkUrl={playlist.artworkUrl}
                      collageArtworks={playlist.collageArtworks}
                      trackCount={playlist.trackCount}
                      title={playlist.title}
                      rounded="rounded-xl"
                      className="w-full aspect-square shadow-md mb-2"
                      onPlay={() => {
                        if (playlist.tracks && playlist.tracks.length > 0) {
                          onPlaySong(playlist.tracks[0], playlist.tracks);
                        }
                      }}
                    />
                    <p className="text-xs font-semibold text-white truncate">{playlist.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{playlist.trackCount} tracks</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

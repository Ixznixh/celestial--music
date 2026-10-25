import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView, Song, Album, Artist, Playlist, AppSettings } from './types';
import { usePlayer } from './hooks/usePlayer';
import { useLibrary } from './hooks/useLibrary';
import { useDownloads } from './hooks/useDownloads';
import { db } from './services/indexedDB';

// Layout Components
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { MiniPlayer } from './components/layout/MiniPlayer';
import { DesktopPlayerBar } from './components/player/DesktopPlayerBar';
import { OfflineIndicator } from './components/common/OfflineIndicator';

// Pages
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { AlbumPage } from './pages/AlbumPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SeeAllPage } from './pages/SeeAllPage';

// Modals
import { NowPlayingModal } from './components/player/NowPlayingModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { TrackContextMenu } from './components/common/TrackContextMenu';
import { AddToPlaylistModal } from './components/common/AddToPlaylistModal';
import { NewPlaylistModal } from './components/common/NewPlaylistModal';
import { SpotifyImportModal } from './components/settings/SpotifyImportModal';
import { ConnectivityModal } from './components/connectivity/ConnectivityModal';
import { recordScrobble } from './services/connectivity';
import { ensureAccountScopeReady, onAccountScopeChange } from './services/accountScope';

export function App() {
  // Navigation stack
  const [currentView, setCurrentView] = useState<AppView>({ type: 'home' });
  const [history, setHistory] = useState<AppView[]>([]);
  const [navDirection, setNavDirection] = useState<number>(1);

  // Modals
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contextMenuSong, setContextMenuSong] = useState<Song | null>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<Song | null>(null);
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSpotifyImportOpen, setIsSpotifyImportOpen] = useState(false);
  const [isConnectivityOpen, setIsConnectivityOpen] = useState(false);

  useEffect(() => {
    // Check if user came with ?spotify_import=1 or #spotify-import
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('spotify_import') || params.get('import') === 'spotify' || window.location.hash === '#spotify-import') {
        setIsSpotifyImportOpen(true);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {}

    const handleOpenSpotify = () => setIsSpotifyImportOpen(true);
    const handleOpenConnectivity = () => setIsConnectivityOpen(true);
    window.addEventListener('celestial-open-spotify-import', handleOpenSpotify);
    window.addEventListener('celestial-open-connectivity', handleOpenConnectivity);
    return () => {
      window.removeEventListener('celestial-open-spotify-import', handleOpenSpotify);
      window.removeEventListener('celestial-open-connectivity', handleOpenConnectivity);
    };
  }, []);

  // Settings with all YouTube Music options
  const [settings, setSettings] = useState<AppSettings>({
    appearance: 'dark',
    reduceAnimation: false,
    reduceDynamicBlur: false,
    liquidGlass: true,
    fullscreenCoverArt: false,
    legacyMeshGradient: false,
    animatedCoverArt: true,
    playAnimatedCoverOverCellular: false,
    syncedLyrics: true,
    blurUnfocusedLyrics: true,
    lyricsSource: 'all',
    translationLanguage: 'en',
    audioQuality: 'lossless',
    audioQualityWifi: 'lossless',
    audioQualityMobile: 'lossless',
    downloadQuality: 'lossless',
    downloadOverWifiOnly: true,
    exportCompatibleDownloads: false,
    dolbyAtmos: false,
    enableJioSaavnSource: true,
    trackLengthTolerance: 3,
    preferMusicOnly: false,
    outputPrecision: '16-bit PCM',
    preferUsbDac: false,
    loudnessNormalization: true,
    crossfade: 0,
    automix: false,
    automixPerformance: 'Balanced',
    skipSilence: false,
    spatialAudio: false,
    autoplay: true,
    soundCheck: true,
    equalizerEnabled: false,
    equalizerPreset: 'Flat',
    equalizerBands: [0, 0, 0, 0, 0, 0, 0],
    equalizerBassTone: 0,
    equalizerTrebleTone: 0,
    equalizerBalance: 0,
    highPerformanceMode: false,
    lowPowerMode: false,
    autoLowPowerOnBattery: false,
    lowPowerBackgroundSync: true,
    lowPowerStopAnimations: true,
    localMusicFolder: 'All audio folders',
    filterNonMusicAudio: true,
    songCacheLimitMB: 512,
    workOutGenres: true,
    discordRichPresence: false,
    listenBrainzToken: '',
    listenBrainzEnabled: false,
    lastFmEnabled: false,
    lastFmUser: '',
    spotifyCanvasEnabled: true,
    playNextOnSwipe: false,
    dontRepeatSongsInSession: false,
    stopMusicOnCloseFromRecents: false,
    hideVolumeBar: false,
    hideSongStatus: false,
    appLanguage: 'en',
    smartAudioAlignment: true,
    showStatsForNerds: false,
  });

  // Hooks
  const player = usePlayer();
  const library = useLibrary();
  const downloads = useDownloads();

  // Scrobble listener (triggers when track reaches 50% duration or 4 minutes)
  const scrobbledSongIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!player.currentSong) {
      scrobbledSongIdRef.current = null;
      return;
    }
    if (scrobbledSongIdRef.current === player.currentSong.id) return;

    const duration = player.duration || (player.currentSong.duration ? Number(player.currentSong.duration) : 0);
    if (duration > 10 && player.currentTime >= Math.min(duration * 0.5, 240)) {
      scrobbledSongIdRef.current = player.currentSong.id;
      recordScrobble(player.currentSong);
    }
  }, [player.currentSong, player.currentTime, player.duration]);

  // Helper to determine relative index of view
  const getViewRank = (view: AppView) => {
    switch (view.type) {
      case 'home': return 0;
      case 'explore': return 1;
      case 'library': return 2;
      case 'search': return 3;
      default: return 4;
    }
  };

  const getViewKey = (view: AppView) => {
    switch (view.type) {
      case 'album': return `album-${view.albumId}`;
      case 'artist': return `artist-${view.artistId}`;
      case 'playlist': return `playlist-${view.playlistId}`;
      case 'seeAll': return `seeAll-${view.sectionId}`;
      default: return view.type;
    }
  };

  // Reset mini player dismissal on track change
  useEffect(() => {
    if (player.currentSong) {
      setIsMiniPlayerDismissed(false);
    }
  }, [player.currentSong?.id]);

  // Load persistent settings — each account has its own copy in its own stores
  const loadSettings = useCallback(async () => {
    try {
      const saved = await db.getSetting<AppSettings | null>('celestial_settings', null);
      if (saved) {
        setSettings(saved);
        return;
      }
      const legacy = await db.getSetting<AppSettings | null>('luma_settings', null);
      if (legacy) setSettings(legacy);
    } catch (e) {
      console.warn('Settings could not be loaded for this account:', e);
    }
  }, []);

  useEffect(() => {
    // Wait for the first account to be known so settings never load from the wrong scope
    let cancelled = false;
    ensureAccountScopeReady().then(() => {
      if (!cancelled) loadSettings();
    });

    // Sign-in, sign-out and account switches all swap the stores underneath us
    const unsubscribeScope = onAccountScopeChange(() => {
      loadSettings();
      library.reloadLibrary();
    });

    return () => {
      cancelled = true;
      unsubscribeScope();
    };
  }, [loadSettings, library.reloadLibrary]);

  // Sync appearance with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (settings.appearance === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    }
  }, [settings.appearance]);

  // Sync Low Power Mode class on document root to disable heavy animations/blurs globally
  useEffect(() => {
    const root = document.documentElement;
    if (settings.lowPowerMode) {
      root.classList.add('low-power-mode');
    } else {
      root.classList.remove('low-power-mode');
    }
  }, [settings.lowPowerMode]);

  // Auto Low Power Mode when device battery reaches 20% or less
  useEffect(() => {
    if (!settings.autoLowPowerOnBattery || typeof navigator === 'undefined' || !('getBattery' in navigator)) return;

    let batteryInstance: any = null;
    const checkBattery = () => {
      if (!batteryInstance) return;
      const isCritical = batteryInstance.level <= 0.2 && !batteryInstance.charging;
      if (isCritical && !settings.lowPowerMode) {
        updateSettings({ lowPowerMode: true });
      }
    };

    (navigator as any).getBattery().then((battery: any) => {
      batteryInstance = battery;
      checkBattery();
      battery.addEventListener('levelchange', checkBattery);
      battery.addEventListener('chargingchange', checkBattery);
    }).catch(() => {});

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('levelchange', checkBattery);
        batteryInstance.removeEventListener('chargingchange', checkBattery);
      }
    };
  }, [settings.autoLowPowerOnBattery, settings.lowPowerMode]);

  // Sync crossfade configuration with player audio engine
  useEffect(() => {
    if (typeof player.setCrossfade === 'function') {
      player.setCrossfade(settings.crossfade || 0);
    }
  }, [settings.crossfade, player.setCrossfade]);

  // Sync all settings (DSP, Equalizer, Loudness Normalization, Spatial Audio) with player audio engine
  useEffect(() => {
    if (typeof (player as any).updateSettings === 'function') {
      (player as any).updateSettings(settings);
    }
  }, [settings, player]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      db.saveSetting('celestial_settings', updated);
      return updated;
    });
  };

  // Navigation handlers
  const navigateTo = useCallback((view: AppView) => {
    const currentRank = getViewRank(currentView);
    const targetRank = getViewRank(view);
    setNavDirection(targetRank >= currentRank ? 1 : -1);
    setHistory((prev) => [...prev, currentView]);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView]);

  const navigateBack = useCallback(() => {
    setNavDirection(-1);
    if (history.length > 0) {
      const prevView = history[history.length - 1];
      setHistory((prev) => prev.slice(0, prev.length - 1));
      setCurrentView(prevView);
    } else {
      setCurrentView({ type: 'home' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [history]);

  // Global keyboard shortcuts (Space to toggle, Esc to dismiss modals, ? for shortcut guide)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        player.togglePlay();
      } else if (e.key === '?') {
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'ArrowRight' && !isNowPlayingOpen) {
        player.next();
      } else if (e.key === 'ArrowLeft' && !isNowPlayingOpen) {
        player.previous();
      } else if (e.code === 'Escape') {
        if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isNowPlayingOpen) setIsNowPlayingOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (contextMenuSong) setContextMenuSong(null);
        else if (addToPlaylistSong) setAddToPlaylistSong(null);
        else if (isNewPlaylistOpen) setIsNewPlaylistOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, isNowPlayingOpen, isSettingsOpen, contextMenuSong, addToPlaylistSong, isNewPlaylistOpen, isShortcutsOpen]);

  // Playback wrappers
  const handlePlaySong = (song: Song, contextQueue?: Song[]) => {
    player.playTrack(song, contextQueue);
  };

  const handlePlayAll = (songs: Song[], shuffle: boolean = false) => {
    if (!songs || songs.length === 0) return;
    const queueToPlay = shuffle ? [...songs].sort(() => Math.random() - 0.5) : [...songs];
    player.playTrack(queueToPlay[0], queueToPlay);
  };

  // Get current view title for TopBar
  const getViewTitle = () => {
    if (currentView.type === 'album') return 'Album';
    if (currentView.type === 'artist') return 'Artist';
    if (currentView.type === 'playlist') return 'Playlist';
    if (currentView.type === 'seeAll') return currentView.title;
    return undefined;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col selection:bg-white selection:text-black font-sans antialiased relative">
      {/* Offline Connectivity Notification */}
      <OfflineIndicator />

      {/* Top Header Bar */}
      <TopBar
        currentView={currentView}
        onNavigateBack={navigateBack}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenConnectivity={() => setIsConnectivityOpen(true)}
        onNavigate={navigateTo}
        title={getViewTitle()}
        lowPowerMode={settings.lowPowerMode}
      />

      {/* Active Screen View */}
      <main className="flex-1 overflow-x-hidden relative min-h-[calc(100vh-8rem)]">
        <AnimatePresence mode="popLayout" custom={navDirection} initial={false}>
          <motion.div
            key={getViewKey(currentView)}
            custom={navDirection}
            initial={{ opacity: 0, x: navDirection * 36, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: navDirection * -36, filter: 'blur(3px)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.55 }}
            className="w-full"
          >
            {currentView.type === 'home' && (
              <HomePage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAlbum={(album) => handlePlayAll(album.tracks)}
                onPlayPlaylist={(pl) => handlePlayAll(pl.tracks)}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                onToggleFavorite={library.toggleFavorite}
                isFavorite={library.isFavorite}
                recentlyPlayed={library.recentlyPlayed}
                favoriteSongs={library.favoriteSongs}
                settings={settings}
              />
            )}

            {currentView.type === 'explore' && (
              <ExplorePage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAlbum={(album) => handlePlayAll(album.tracks)}
                onPlayPlaylist={(pl) => handlePlayAll(pl.tracks)}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
              />
            )}

            {currentView.type === 'search' && (
              <SearchPage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
              />
            )}

            {currentView.type === 'library' && (
              <LibraryPage
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                onRequestNewPlaylist={() => setIsNewPlaylistOpen(true)}
                favoriteSongs={library.favoriteSongs}
                savedAlbums={library.savedAlbums}
                savedArtists={library.savedArtists}
                playlists={library.playlists}
                recentlyPlayed={library.recentlyPlayed}
                onDeletePlaylist={library.deletePlaylist}
              />
            )}

            {currentView.type === 'album' && (
              <AlbumPage
                albumId={currentView.albumId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                isSaved={library.isAlbumSaved(currentView.albumId)}
                onToggleSaveAlbum={library.toggleSaveAlbum}
              />
            )}

            {currentView.type === 'artist' && (
              <ArtistPage
                artistId={currentView.artistId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                isSaved={library.isArtistSaved(currentView.artistId)}
                onToggleSaveArtist={library.toggleSaveArtist}
              />
            )}

            {currentView.type === 'playlist' && (
              <PlaylistPage
                playlistId={currentView.playlistId}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onPlayAll={handlePlayAll}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                userPlaylists={library.playlists}
                onUpdatePlaylist={library.updatePlaylist}
                onDeletePlaylist={library.deletePlaylist}
                onRemoveSongFromPlaylist={library.removeSongFromPlaylist}
                onReorderPlaylist={library.reorderPlaylistTracks}
              />
            )}

            {currentView.type === 'seeAll' && (
              <SeeAllPage
                sectionId={currentView.sectionId}
                title={currentView.title}
                onNavigate={navigateTo}
                onPlaySong={handlePlaySong}
                onOpenContextMenu={(song) => setContextMenuSong(song)}
                recentlyPlayed={library.recentlyPlayed}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Player Error Notification Toast */}
      {player.error && (
        <div className="fixed top-20 sm:top-24 inset-x-4 z-50 max-w-md mx-auto pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/95 border border-rose-500/30 text-rose-200 text-xs shadow-2xl backdrop-blur-md">
            <span className="truncate mr-2">{player.error}</span>
            <button
              onClick={() => player.next()}
              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium shrink-0 transition text-[11px]"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Persistent Mini Player (Mobile and Tablet, floating pill) */}
      <MiniPlayer
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        isOpen={!isNowPlayingOpen && !isMiniPlayerDismissed}
        onTogglePlay={player.togglePlay}
        onNext={player.next}
        onPrevious={player.previous}
        onOpenFullPlayer={() => setIsNowPlayingOpen(true)}
        onClose={() => setIsMiniPlayerDismissed(true)}
      />

      {/* Persistent Desktop Player Bar (Desktop/PC, fixed to bottom) */}
      <DesktopPlayerBar
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        isMuted={player.isMuted}
        shuffle={player.shuffle}
        repeat={player.repeat}
        isFavorite={player.currentSong ? library.isFavorite(player.currentSong.id) : false}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onNext={player.next}
        onPrevious={player.previous}
        onSetVolume={player.setVolume}
        onToggleMute={player.toggleMute}
        onToggleShuffle={player.toggleShuffle}
        onCycleRepeat={player.cycleRepeatMode}
        onToggleFavorite={() => player.currentSong && library.toggleFavorite(player.currentSong)}
        onOpenFullPlayer={() => setIsNowPlayingOpen(true)}
        onOpenQueue={() => setIsNowPlayingOpen(true)}
        onOpenLyrics={() => setIsNowPlayingOpen(true)}
        queueLength={player.queue.length}
      />

      {/* Persistent Bottom Navigation Bar */}
      <BottomNav currentView={currentView} onNavigate={navigateTo} />

      {/* Full Screen Now Playing Sheet */}
      <AnimatePresence>
        {isNowPlayingOpen && player.currentSong && (
          <NowPlayingModal
            isOpen={isNowPlayingOpen}
            onClose={() => setIsNowPlayingOpen(false)}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            volume={player.volume}
            isMuted={player.isMuted}
            shuffle={player.shuffle}
            repeat={player.repeat}
            queue={player.queue}
            queueIndex={player.queueIndex}
            userQueue={player.userQueue}
            suggestionsQueue={player.suggestionsQueue}
            isFavorite={library.isFavorite(player.currentSong.id)}
            settings={settings}
            onUpdateSettings={updateSettings}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onNext={player.next}
            onPrevious={player.previous}
            onSetVolume={player.setVolume}
            onToggleMute={player.toggleMute}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeatMode}
            onToggleFavorite={library.toggleFavorite}
            onSelectTrack={(song, idx) => player.playTrack(song, player.queue)}
            onPlayQueueIndex={player.playQueueIndex}
            isLoadingSuggestions={player.isLoadingSuggestions}
            onClearUpcoming={player.clearUpcoming}
            onClearUserQueue={player.clearUserQueue}
            onClearAutoplayQueue={player.clearAutoplayQueue}
            onLoadMoreSuggestions={() => player.loadSuggestions()}
            onRemoveFromQueue={player.removeFromQueue}
            onReorderQueue={player.reorderQueue}
            onSetUpcomingTracks={player.setUpcomingTracks}
            onClearQueue={player.clearQueue}
            onNavigateToAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
            onNavigateToArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenConnectivity={() => {
          setIsSettingsOpen(false);
          setIsConnectivityOpen(true);
        }}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClearRecentlyPlayed={library.clearRecentlyPlayed}
        onResetLibrary={async () => {
          if (confirm('Clear local database and reset cached library?')) {
            await db.clearAll();
            await library.reloadLibrary();
            setIsSettingsOpen(false);
          }
        }}
      />

      {/* Connectivity & Accounts Hub Modal */}
      <ConnectivityModal
        isOpen={isConnectivityOpen}
        onClose={() => setIsConnectivityOpen(false)}
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        onImportPlaylist={library.importPlaylist}
      />



      {/* Track Overflow Context Menu */}
      {contextMenuSong && (
        <TrackContextMenu
          song={contextMenuSong}
          isOpen={Boolean(contextMenuSong)}
          isFav={library.isFavorite(contextMenuSong.id)}
          onClose={() => setContextMenuSong(null)}
          onToggleFavorite={library.toggleFavorite}
          onPlayNext={player.playNext}
          onAddToQueue={player.addToQueue}
          onAddToPlaylist={(song) => setAddToPlaylistSong(song)}
          onNavigateToAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
          onNavigateToArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
          isDownloaded={downloads.isDownloaded(contextMenuSong.id)}
          isDownloading={downloads.isDownloading(contextMenuSong.id)}
          downloadProgress={downloads.getProgress(contextMenuSong.id)}
          onDownload={(song) => {
            void downloads.downloadSong(song);
          }}
          onRemoveDownload={downloads.removeDownload}
        />
      )}

      {/* Add To Playlist Modal */}
      {addToPlaylistSong && (
        <AddToPlaylistModal
          song={addToPlaylistSong}
          isOpen={Boolean(addToPlaylistSong)}
          playlists={library.playlists}
          onClose={() => setAddToPlaylistSong(null)}
          onAddToPlaylist={library.addSongToPlaylist}
          onCreateNewPlaylist={() => setIsNewPlaylistOpen(true)}
        />
      )}

      {/* New Playlist Modal */}
      <NewPlaylistModal
        isOpen={isNewPlaylistOpen}
        onClose={() => setIsNewPlaylistOpen(false)}
        onCreate={async (title, desc) => {
          const newPl = await library.createPlaylist(title, desc);
          if (addToPlaylistSong) {
            library.addSongToPlaylist(newPl.id, addToPlaylistSong);
            setAddToPlaylistSong(null);
          }
        }}
      />

      {/* Spotify Import Modal */}
      <SpotifyImportModal
        isOpen={isSpotifyImportOpen}
        onClose={() => setIsSpotifyImportOpen(false)}
      />

      {/* Keyboard Shortcut Guide */}
      <AnimatePresence>
        {isShortcutsOpen && (
          <>
            <motion.div
              key="shortcuts-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsShortcutsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              key="shortcuts-modal"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-sm mx-auto bg-[#111113] border border-white/10 rounded-3xl shadow-2xl p-5 select-none"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setIsShortcutsOpen(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-1">
                {[
                  { keys: ['Space'], description: 'Play / Pause' },
                  { keys: ['←'], description: 'Previous track' },
                  { keys: ['→'], description: 'Next track' },
                  { keys: ['Esc'], description: 'Close modal / Go back' },
                  { keys: ['?'], description: 'Toggle this guide' },
                ].map(({ keys, description }) => (
                  <div key={description} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm text-neutral-300">{description}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k) => (
                        <kbd key={k} className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-xs font-mono text-white font-semibold shadow">{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600 mt-4 text-center">Press <kbd className="px-1 rounded bg-white/10 text-[10px] font-mono">?</kbd> anywhere to toggle</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

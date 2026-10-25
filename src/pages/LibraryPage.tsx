import React, { useState, useEffect } from 'react';
import { Song, Album, Artist, Playlist, AppView } from '../types';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { PlaylistThumbnail } from '../components/common/PlaylistThumbnail';
import { GlassSwitch } from '../components/common/GlassSwitch';
import { formatTime } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { useDownloads, formatBytes } from '../hooks/useDownloads';
import { isAutoDownloadEnabled, setAutoDownloadEnabled } from '../services/autoDownload';
import { providerManager } from '../services/providerManager';
import { enrichPlaylistThumbnails } from '../services/thumbnailEnricher';
import { 
  ListMusic, 
  User, 
  Disc, 
  Music, 
  Plus, 
  ChevronRight, 
  Play, 
  MoreHorizontal, 
  Heart, 
  Clock, 
  Trash2,
  Download,
  HardDrive
} from 'lucide-react';

interface LibraryPageProps {
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, contextQueue?: Song[]) => void;
  onOpenContextMenu: (song: Song) => void;
  onRequestNewPlaylist: () => void;
  favoriteSongs: Song[];
  savedAlbums: Album[];
  savedArtists: Artist[];
  playlists: Playlist[];
  recentlyPlayed: Song[];
  onDeletePlaylist: (playlistId: string) => void;
}

type LibraryTab = 'overview' | 'playlists' | 'songs' | 'albums' | 'artists' | 'downloads';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onNavigate,
  onPlaySong,
  onOpenContextMenu,
  onRequestNewPlaylist,
  favoriteSongs,
  savedAlbums,
  savedArtists,
  playlists,
  recentlyPlayed,
  onDeletePlaylist,
}) => {
  const [tab, setTab] = useState<LibraryTab>('overview');

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  // Downloads live in their own IndexedDB-backed collection: count, bytes and the
  // auto-download policy are all read from the device this session is running on.
  const downloads = useDownloads();
  const [autoDownload, setAutoDownload] = useState(false);

  useEffect(() => {
    isAutoDownloadEnabled().then(setAutoDownload).catch(() => {});
  }, []);

  // Background enrichment for imported playlists with missing thumbnails
  useEffect(() => {
    if (!playlists || playlists.length === 0) return;
    for (const pl of playlists) {
      const hasMissing =
        !pl.artworkUrl ||
        pl.artworkUrl.includes('unsplash.com') ||
        (pl.tracks && pl.tracks.some((t) => !t.artworkUrl || t.artworkUrl.includes('unsplash.com')));
      if (hasMissing) {
        enrichPlaylistThumbnails(pl).catch(() => {});
      }
    }
  }, [playlists]);

  const handleAutoDownloadToggle = (enabled: boolean) => {
    setAutoDownload(enabled);
    setAutoDownloadEnabled(enabled).catch(() => {});
  };

  const [downloadingPlaylistId, setDownloadingPlaylistId] = useState<string | null>(null);

  const handleDownloadPlaylist = async (pl: Playlist) => {
    if (downloadingPlaylistId) return;
    let tracks = pl.tracks || [];
    if (tracks.length === 0) {
      setDownloadingPlaylistId(pl.id);
      try {
        const fullPl = await providerManager.getActiveProvider().getPlaylist(pl.id);
        if (fullPl?.tracks?.length) {
          tracks = fullPl.tracks;
        }
      } catch (e) {
        console.warn('Failed to load playlist for download:', e);
      }
      setDownloadingPlaylistId(null);
    }

    if (tracks.length === 0) return;

    const allDownloaded = tracks.every((t) => downloads.isDownloaded(t.id));
    if (allDownloaded) {
      if (window.confirm(`Remove offline downloads for all ${tracks.length} songs in "${pl.title}"?`)) {
        for (const t of tracks) {
          await downloads.removeDownload(t.id);
        }
      }
      return;
    }

    setDownloadingPlaylistId(pl.id);
    const pending = tracks.filter((t) => !downloads.isDownloaded(t.id));
    for (const song of pending) {
      await downloads.downloadSong(song);
    }
    setDownloadingPlaylistId(null);
  };

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-4 space-y-6 pb-36 md:pb-28"
    >
      {/* Title & Add Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Library</h2>
        </div>
        <button
          onClick={onRequestNewPlaylist}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs transition shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Navigation Tabs Pill selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {(['overview', 'downloads', 'playlists', 'songs', 'albums', 'artists'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all flex items-center gap-1.5 ${
              tab === t
                ? 'bg-rose-600 text-white font-semibold shadow'
                : 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
            }`}
          >
            <span>{t === 'overview' ? 'Overview' : t === 'downloads' ? 'Downloaded Songs' : t}</span>
            {t === 'downloads' && downloads.downloadCount > 0 && (
              <span className="text-[10px] tabular-nums opacity-80">{downloads.downloadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW VIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Category Rows */}
          <div className="divide-y divide-neutral-800/80 bg-neutral-850/80 rounded-xl border border-neutral-800 overflow-hidden">
            <button
              onClick={() => setTab('playlists')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <ListMusic className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Playlists</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{playlists.length + (favoriteSongs.length > 0 ? 1 : 0)}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('albums')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <Disc className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Saved Albums</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{savedAlbums.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            <button
              onClick={() => setTab('artists')}
              className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/60 active:bg-neutral-800 text-left transition"
            >
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-white">Artists</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <span className="text-xs">{savedArtists.length}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* Quick Playlists preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Your Playlists</h3>
              <button
                onClick={() => setTab('playlists')}
                className="text-xs text-rose-500 hover:text-rose-400 font-medium"
              >
                See All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {/* Favorited Songs Playlist Card */}
              <div
                onClick={() => setTab('songs')}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition group relative"
              >
                <div className="w-full aspect-square rounded-lg shadow mb-1.5 bg-gradient-to-br from-indigo-700 via-purple-700 to-rose-600 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-lg transition">
                  <Heart className="w-9 h-9 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                  {favoriteSongs.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(favoriteSongs[0], favoriteSongs);
                      }}
                      className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                      title="Play Favorited Songs"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-semibold text-white truncate leading-tight">Favorited Songs</p>
                <p className="text-[10px] text-neutral-400 truncate mt-0.5">{favoriteSongs.length} tracks</p>
              </div>

              {playlists.slice(0, 5).map((pl) => {
                const isAllDl = Boolean(pl.tracks && pl.tracks.length > 0 && pl.tracks.every((t) => downloads.isDownloaded(t.id)));
                const isDlIng = downloadingPlaylistId === pl.id || Boolean(pl.tracks && pl.tracks.some((t) => downloads.isDownloading(t.id)));
                return (
                  <div
                    key={pl.id}
                    onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                    className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                  >
                    <PlaylistThumbnail
                      artworkUrl={pl.artworkUrl}
                      collageArtworks={pl.collageArtworks}
                      trackCount={pl.trackCount}
                      title={pl.title}
                      rounded="rounded-lg"
                      className="w-full aspect-square mb-1.5"
                      showPlayButton={false}
                      onDownload={() => handleDownloadPlaylist(pl)}
                      isDownloaded={isAllDl}
                      isDownloading={isDlIng}
                    />
                    <p className="text-xs font-semibold text-white truncate leading-tight">{pl.title}</p>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">{pl.trackCount} tracks</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. PLAYLISTS VIEW */}
      {tab === 'playlists' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {/* Favorited Songs Playlist Card */}
            <div
              onClick={() => setTab('songs')}
              className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
            >
              <div className="w-full aspect-square rounded-xl shadow-md mb-2 bg-gradient-to-br from-indigo-700 via-purple-700 to-rose-600 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-lg transition">
                <Heart className="w-12 h-12 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                {favoriteSongs.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySong(favoriteSongs[0], favoriteSongs);
                    }}
                    className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 cursor-pointer"
                    title="Play Favorited Songs"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-white truncate">Favorited Songs</p>
              <p className="text-[11px] text-neutral-400 truncate">{favoriteSongs.length} tracks</p>
            </div>

            {/* Downloaded Songs Playlist Card */}
            {downloads.downloadCount > 0 && (
              <div
                onClick={() => setTab('songs')}
                className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
              >
                <div className="w-full aspect-square rounded-xl shadow-md mb-2 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-lg transition">
                  <HardDrive className="w-12 h-12 text-emerald-200 drop-shadow-md" />
                  {downloads.downloadCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(
                          downloads.downloadedTracks[0].song,
                          downloads.downloadedTracks.map((track) => track.song)
                        );
                      }}
                      className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-emerald-300 hover:bg-emerald-200 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 cursor-pointer"
                      title="Play Downloaded Songs"
                    >
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-semibold text-white truncate">Downloaded Songs</p>
                <p className="text-[11px] text-neutral-400 truncate">{downloads.downloadCount} tracks</p>
              </div>
            )}

            {playlists.map((pl) => {
              const isAllDl = Boolean(pl.tracks && pl.tracks.length > 0 && pl.tracks.every((t) => downloads.isDownloaded(t.id)));
              const isDlIng = downloadingPlaylistId === pl.id || Boolean(pl.tracks && pl.tracks.some((t) => downloads.isDownloading(t.id)));
              return (
                <div
                  key={pl.id}
                  onClick={() => onNavigate({ type: 'playlist', playlistId: pl.id })}
                  className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition relative group"
                >
                  <PlaylistThumbnail
                    artworkUrl={pl.artworkUrl}
                    collageArtworks={pl.collageArtworks}
                    trackCount={pl.trackCount}
                    title={pl.title}
                    rounded="rounded-xl"
                    className="w-full aspect-square shadow-md mb-2"
                    onPlay={() => {
                      if (pl.tracks && pl.tracks.length > 0) {
                        onPlaySong(pl.tracks[0], pl.tracks);
                      }
                    }}
                    onDownload={() => handleDownloadPlaylist(pl)}
                    isDownloaded={isAllDl}
                    isDownloading={isDlIng}
                  />
                  <p className="text-xs font-semibold text-white truncate">{pl.title}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{pl.trackCount} tracks</p>

                {pl.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete playlist "${pl.title}"?`)) {
                        onDeletePlaylist(pl.id);
                      }
                    }}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/70 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FAVORITE SONGS VIEW */}
      {tab === 'songs' && (
        <div className="space-y-3">
          {favoriteSongs.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Heart className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Favorite Songs Yet</p>
              <p className="text-xs text-neutral-500 mt-1">
                Tap the heart on any song to add it to your favorites.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-850 bg-neutral-900/70 rounded-xl border border-neutral-800 overflow-hidden">
              {favoriteSongs.map((song) => (
                <div
                  key={song.id}
                  {...getHandlers(song)}
                  className="flex items-center justify-between p-2 pr-3 hover:bg-neutral-800/80 active:bg-neutral-800 transition cursor-pointer"
                >
                  <button
                    onClick={() => onPlaySong(song, favoriteSongs)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <ArtworkImage
                      src={song.artworkUrl}
                      fallbackVideoId={song.id}
                      alt={song.title}
                      artist={song.artist}
                      rounded="rounded-md"
                      size="small"
                      className="w-10 h-10 rounded-md shrink-0 shadow-sm"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-white truncate leading-tight">{song.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{song.artist}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {formatTime(song.duration)}
                    </span>
                    <button
                      onClick={() => onOpenContextMenu(song)}
                      className="p-1.5 rounded-full text-neutral-400 hover:text-white transition"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SAVED ALBUMS VIEW */}
      {tab === 'albums' && (
        <div className="space-y-4">
          {savedAlbums.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Disc className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Saved Albums</p>
              <p className="text-xs text-neutral-500 mt-1">
                Browse or search for albums and tap &quot;Save to Library&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {savedAlbums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => onNavigate({ type: 'album', albumId: album.id })}
                  className="p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
                >
                  <ArtworkImage src={album.artworkUrl} alt={album.title} rounded="rounded-xl" className="w-full aspect-square rounded-xl shadow-md mb-2" />
                  <p className="text-xs font-semibold text-white truncate leading-tight">{album.title}</p>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">{album.artist} • {album.releaseYear}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. SAVED ARTISTS VIEW */}
      {tab === 'artists' && (
        <div className="space-y-4">
          {savedArtists.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <User className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Followed Artists</p>
              <p className="text-xs text-neutral-500 mt-1">
                Follow your favorite artists to keep up with their latest releases.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {savedArtists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => onNavigate({ type: 'artist', artistId: artist.id })}
                  className="p-3 rounded-2xl bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 cursor-pointer active:scale-95 transition text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-md mb-2 border border-white/10">
                    <ArtworkImage src={artist.avatarUrl} alt={artist.name} aspectRatio="avatar" className="w-full h-full" />
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{artist.name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{artist.genre}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. DOWNLOADS VIEW — the offline collection */}
      {tab === 'downloads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {downloads.downloadCount} {downloads.downloadCount === 1 ? 'song' : 'songs'}{' '}
                  downloaded
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  {downloads.storageFormatted} used · plays with no connection
                </p>
              </div>
            </div>
            {downloads.downloadCount > 0 && (
              <button
                onClick={() => downloads.clearAllDownloads()}
                className="px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-[11px] font-semibold text-neutral-300 active:scale-95 transition shrink-0"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Auto-download saved music</p>
              <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                Albums and playlists you save are stored for offline listening. Paused while
                offline, and on cellular when “Download over Wi-Fi only” is on.
              </p>
            </div>
            <GlassSwitch
              checked={autoDownload}
              onChange={handleAutoDownloadToggle}
              ariaLabel="Auto-download saved music"
            />
          </div>

          {downloads.downloadCount === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Download className="w-10 h-10 mx-auto mb-2 opacity-40 text-neutral-500" />
              <p className="font-semibold text-white">No Downloads Yet</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Long-press any song and choose Download to keep it on this device — or turn
                on auto-download above and save an album.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-850 bg-neutral-900/70 rounded-xl border border-neutral-800 overflow-hidden">
              {downloads.downloadedTracks.map(({ song, sizeBytes }) => (
                <div
                  key={song.id}
                  {...getHandlers(song)}
                  className="flex items-center justify-between p-2 pr-3 hover:bg-neutral-800/80 active:bg-neutral-800 transition cursor-pointer"
                >
                  <button
                    onClick={() =>
                      onPlaySong(
                        song,
                        downloads.downloadedTracks.map((track) => track.song)
                      )
                    }
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <ArtworkImage
                      src={song.artworkUrl}
                      fallbackVideoId={song.id}
                      alt={song.title}
                      artist={song.artist}
                      rounded="rounded-md"
                      size="small"
                      className="w-10 h-10 rounded-md shrink-0 shadow-sm"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-white truncate leading-tight">
                        {song.title}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 leading-tight">
                        {song.artist} · {formatBytes(sizeBytes)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {formatTime(song.duration)}
                    </span>
                    <button
                      onClick={() => downloads.removeDownload(song.id)}
                      aria-label="Remove download"
                      className="p-1.5 rounded-full text-neutral-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

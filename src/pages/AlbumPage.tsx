import React, { useEffect, useState } from 'react';
import { Album, Song, AppView } from '../types';
import { providerManager } from '../services/providerManager';
import { ArtworkImage } from '../components/common/ArtworkImage';
import { formatTime, formatDuration } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { 
  Play, 
  Shuffle, 
  Bookmark, 
  BookmarkCheck, 
  MoreHorizontal, 
  ChevronRight, 
  Share2,
  ArrowDown,
  Download,
  Check
} from 'lucide-react';
import { useDownloads } from '../hooks/useDownloads';

interface AlbumPageProps {
  albumId: string;
  onNavigate: (view: AppView) => void;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayAll: (songs: Song[], shuffle?: boolean) => void;
  onOpenContextMenu: (song: Song) => void;
  isSaved: boolean;
  onToggleSaveAlbum: (album: Album) => void;
}

export const AlbumPage: React.FC<AlbumPageProps> = ({
  albumId,
  onNavigate,
  onPlaySong,
  onPlayAll,
  onOpenContextMenu,
  isSaved,
  onToggleSaveAlbum,
}) => {
  const [album, setAlbum] = useState<Album | null>(null);
  const [moreAlbums, setMoreAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    isDownloaded,
    isDownloading,
    getProgress,
    downloadSong,
    removeDownload,
  } = useDownloads();

  const [isDownloadingAlbum, setIsDownloadingAlbum] = useState(false);
  const [downloadStep, setDownloadStep] = useState<{ current: number; total: number } | null>(null);

  const downloadedTracksCount = album?.tracks.filter((t) => isDownloaded(t.id)).length || 0;
  const isAllDownloaded = Boolean(
    album &&
    album.tracks.length > 0 &&
    downloadedTracksCount === album.tracks.length
  );
  const isAnyDownloading = Boolean(
    isDownloadingAlbum ||
    album?.tracks.some((t) => isDownloading(t.id))
  );

  const handleToggleDownloadAlbum = async () => {
    if (!album || album.tracks.length === 0 || isAnyDownloading) return;

    if (isAllDownloaded) {
      if (window.confirm(`Remove offline downloads for all ${album.tracks.length} songs in "${album.title}"?`)) {
        for (const t of album.tracks) {
          await removeDownload(t.id);
        }
      }
      return;
    }

    setIsDownloadingAlbum(true);
    const pending = album.tracks.filter((t) => !isDownloaded(t.id));
    setDownloadStep({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      setDownloadStep({ current: i + 1, total: pending.length });
      await downloadSong(pending[i]);
    }

    setIsDownloadingAlbum(false);
    setDownloadStep(null);
  };

  const { getHandlers } = useLongPress<Song>((song) => onOpenContextMenu(song));

  useEffect(() => {
    setIsLoading(true);
    const provider = providerManager.getActiveProvider();
    provider.getAlbum(albumId)
      .then((alb) => {
        setAlbum(alb);
        setIsLoading(false);
        if (alb && alb.artistId) {
          provider.getArtist(alb.artistId)
            .then((artist) => {
              if (artist) {
                setMoreAlbums((artist.albums || []).filter((a) => a.id !== alb.id));
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Failed to load album:', err);
        setAlbum(null);
        setIsLoading(false);
      });
  }, [albumId]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading album…</span>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="py-24 text-center text-neutral-400 px-4">
        <p className="font-semibold text-white">Album Not Found</p>
        <button
          onClick={() => onNavigate({ type: 'home' })}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const totalDuration = album.tracks.reduce((acc, cur) => acc + cur.duration, 0);

  return (
    <div 
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 select-none pt-2 sm:pt-6 space-y-8 pb-36 md:pb-28"
    >
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end text-center sm:text-left gap-5 sm:gap-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 rounded-3xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
          <ArtworkImage src={album.artworkUrl} alt={album.title} rounded="rounded-3xl" size="large" priority className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">
            Album
          </span>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            {album.title}
          </h2>

          <button
            onClick={() => onNavigate({ type: 'artist', artistId: album.artistId })}
            className="text-sm sm:text-base font-semibold text-rose-500 hover:text-rose-400 mt-1 transition inline-block"
          >
            {album.artist}
          </button>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            {album.genre} • {album.releaseYear} • {album.tracks.length} songs, {formatDuration(totalDuration)}
          </p>

          {/* Action Buttons: Play, Shuffle, Download, Library */}
          <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-6 flex-wrap">
            <button
              onClick={() => onPlayAll(album.tracks, false)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition shadow-lg cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => onPlayAll(album.tracks, true)}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-2xl bg-neutral-800 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-750 active:scale-95 transition border border-white/10 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            {/* Spotify-style Download Button */}
            <button
              onClick={handleToggleDownloadAlbum}
              disabled={isAnyDownloading && !isDownloadingAlbum}
              title={
                isAllDownloaded
                  ? `Downloaded (${downloadedTracksCount}/${album.tracks.length}) • Click to remove`
                  : isAnyDownloading
                  ? `Downloading ${downloadStep ? `${downloadStep.current}/${downloadStep.total}` : '...'}`
                  : `Download album for offline listening`
              }
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md select-none shrink-0 ${
                isAllDownloaded
                  ? 'bg-[#1ed760] text-black shadow-[0_0_14px_rgba(30,215,96,0.4)] hover:bg-[#1fdf64] hover:scale-105 active:scale-95'
                  : isAnyDownloading
                  ? 'bg-neutral-800/90 border border-emerald-500/50 text-[#1ed760]'
                  : 'bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-300 hover:text-white border border-white/10 hover:border-white/30 hover:scale-105 active:scale-95'
              }`}
            >
              {isAnyDownloading ? (
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-[#1ed760] animate-spin block" />
                </div>
              ) : isAllDownloaded ? (
                <ArrowDown className="w-5 h-5 stroke-[2.8]" />
              ) : (
                <Download className="w-4.5 h-4.5" />
              )}
            </button>

            <button
              onClick={() => onToggleSaveAlbum(album)}
              title={isSaved ? 'Remove from Library' : 'Save to Library'}
              className={`p-2.5 rounded-2xl border transition active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>

            {/* Download status counter label when in progress or downloaded */}
            {isAnyDownloading && downloadStep && (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 animate-pulse">
                <span>Downloading {downloadStep.current}/{downloadStep.total}...</span>
              </span>
            )}
            {!isAnyDownloading && isAllDownloaded && (
              <span className="text-xs font-semibold text-emerald-400/90 hidden sm:inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Downloaded</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Track List */}
      <div>
        <div className="divide-y divide-neutral-850 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 overflow-hidden">
          {album.tracks.map((song, index) => {
            const trackNum = (song.trackNumber || index + 1).toString().padStart(2, '0');

            return (
              <div
                key={song.id}
                {...getHandlers(song)}
                className="flex items-center justify-between p-3 hover:bg-neutral-800/80 active:bg-neutral-800 transition group cursor-pointer"
              >
                <button
                  onClick={() => onPlaySong(song, album.tracks)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                >
                  <span className="text-xs font-mono text-neutral-500 w-5 text-right shrink-0">
                    {trackNum}
                  </span>
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isDownloaded(song.id) && (
                        <span
                          className="w-3.5 h-3.5 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0 shadow-sm"
                          title="Downloaded"
                        >
                          <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      {isDownloading(song.id) && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-emerald-400 border-t-transparent animate-spin shrink-0"
                          title={`Downloading ${getProgress(song.id)}%`}
                        />
                      )}
                      <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                    </div>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Single track download button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDownloaded(song.id)) {
                        removeDownload(song.id);
                      } else {
                        downloadSong(song);
                      }
                    }}
                    title={isDownloaded(song.id) ? 'Downloaded • Click to remove' : 'Download track'}
                    className={`p-1.5 rounded-full transition cursor-pointer ${
                      isDownloaded(song.id)
                        ? 'text-[#1ed760] hover:text-emerald-300'
                        : isDownloading(song.id)
                        ? 'text-emerald-400'
                        : 'text-neutral-500 hover:text-white hover:bg-neutral-700/60 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isDownloaded(song.id) ? (
                      <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                    ) : isDownloading(song.id) ? (
                      <span className="w-4 h-4 rounded-full border border-emerald-400 border-t-transparent animate-spin block" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {formatTime(song.duration)}
                  </span>
                  <button
                    onClick={() => onOpenContextMenu(song)}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Album Description */}
      {album.description && (
        <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-400 leading-relaxed">
          <p>{album.description}</p>
          <div className="mt-3 text-[11px] text-neutral-500">
            ℗ {album.releaseYear} Celestial Audio Records under royalty-free distribution.
          </div>
        </div>
      )}

      {/* More by Artist */}
      {moreAlbums.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-white tracking-tight">
              More by {album.artist}
            </h3>
            <button
              onClick={() => onNavigate({ type: 'artist', artistId: album.artistId })}
              className="text-xs text-rose-500 hover:text-rose-400 font-medium"
            >
              See All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {moreAlbums.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate({ type: 'album', albumId: item.id })}
                className="p-2.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-850/80 border border-neutral-800/80 cursor-pointer active:scale-95 transition"
              >
                <ArtworkImage src={item.artworkUrl} alt={item.title} className="w-full aspect-square rounded-xl shadow-md mb-2" />
                <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{item.releaseYear}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

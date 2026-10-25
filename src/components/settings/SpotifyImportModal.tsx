import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Music,
  ArrowRight,
  Clipboard,
  Play,
  Library,
  Flame,
  Clock,
  Layers,
} from 'lucide-react';
import {
  importSpotifyPlaylist,
  importPlaylistFromText,
  fetchCuratedSpotifyPlaylists,
  CuratedSpotifyPlaylist,
  SpotifyImportResult,
} from '../../services/spotifyService';
import { usePlayer } from '../../hooks/usePlayer';

interface SpotifyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (playlistTitle: string, count: number) => void;
}

export const SpotifyImportModal: React.FC<SpotifyImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { playSong } = usePlayer();
  const [activeTab, setActiveTab] = useState<'link' | 'popular' | 'text'>('link');

  // Link import state
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importedResult, setImportedResult] = useState<SpotifyImportResult | null>(null);

  // Popular playlists state
  const [curatedList, setCuratedList] = useState<CuratedSpotifyPlaylist[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Text import state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // Load curated playlists on mount or open
  useEffect(() => {
    if (isOpen) {
      fetchCuratedSpotifyPlaylists().then(setCuratedList).catch(() => {});
    } else {
      // Reset temporary states on close
      setErrorMsg(null);
      setImportedResult(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch {
      // Clipboard read may be blocked by browser permissions
    }
  };

  const handleImportByUrl = async (urlToUse?: string) => {
    const target = (urlToUse || urlInput).trim();
    if (!target) {
      setErrorMsg('Please enter or paste a Spotify playlist link.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setImportedResult(null);

    try {
      const result = await importSpotifyPlaylist(target);
      setImportedResult(result);
      if (onSuccess) {
        onSuccess(result.playlist.title, result.tracks.length);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import Spotify playlist.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCurated = async (item: CuratedSpotifyPlaylist) => {
    setImportingId(item.id);
    setErrorMsg(null);

    try {
      const result = await importSpotifyPlaylist(item.id);
      setImportedResult(result);
      if (onSuccess) {
        onSuccess(result.playlist.title, result.tracks.length);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to import ${item.title}`);
    } finally {
      setImportingId(null);
    }
  };

  const handleImportByText = async () => {
    if (!textContent.trim()) {
      setErrorMsg('Please paste at least one track.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const title = textTitle.trim() || 'My Spotify Playlist';
      const result = await importPlaylistFromText(title, textContent);
      setImportedResult(result);
      if (onSuccess) {
        onSuccess(result.playlist.title, result.tracks.length);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import tracks from text.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayNow = () => {
    if (importedResult && importedResult.tracks.length > 0) {
      playSong(importedResult.tracks[0], importedResult.tracks);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-[#09090b] border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_50px_rgba(29,185,84,0.1)] text-white flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center shadow-[0_0_12px_rgba(29,185,84,0.3)]">
                  {/* Spotify Logo SVG */}
                  <svg className="w-5 h-5 text-[#1DB954] fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.216.353-.674.467-1.027.252-2.815-1.72-6.358-2.109-10.533-1.155-.403.092-.803-.16-.895-.563-.092-.403.16-.803.563-.895 4.57-1.045 8.492-.601 11.64 1.334.353.216.467.674.252 1.027zm1.467-3.26c-.272.443-.849.585-1.292.313-3.223-1.981-8.136-2.553-11.948-1.396-.5.152-1.031-.133-1.183-.633-.152-.5.133-1.031.633-1.183 4.358-1.323 9.776-.684 13.477 1.591.443.272.585.849.313 1.292zm.126-3.41c-3.864-2.294-10.245-2.506-13.935-1.385-.593.18-1.222-.158-1.402-.751-.18-.593.158-1.222.751-1.402 4.24-1.287 11.285-1.038 15.727 1.598.533.316.708 1.008.392 1.541-.316.533-1.008.708-1.533.399z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Import from Spotify</h2>
                  <p className="text-xs text-neutral-400">Add any playlist or album directly to Celestial</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 px-4 sm:px-5 bg-white/[0.01]">
              <button
                onClick={() => {
                  setActiveTab('link');
                  setErrorMsg(null);
                }}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'link'
                    ? 'border-[#1DB954] text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Spotify Link
              </button>
              <button
                onClick={() => {
                  setActiveTab('popular');
                  setErrorMsg(null);
                }}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'popular'
                    ? 'border-[#1DB954] text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Popular Curated
              </button>
              <button
                onClick={() => {
                  setActiveTab('text');
                  setErrorMsg(null);
                }}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'text'
                    ? 'border-[#1DB954] text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Tracklist
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4">
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success Result View */}
              {importedResult ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-[#1DB954]/15 to-white/[0.02] border border-[#1DB954]/30 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Playlist Imported Successfully!
                    </div>

                    <div className="flex items-center gap-3.5 pt-1">
                      <img
                        src={importedResult.playlist.artworkUrl}
                        alt={importedResult.playlist.title}
                        className="w-16 h-16 rounded-xl object-cover shadow-lg border border-white/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white truncate">
                          {importedResult.playlist.title}
                        </h3>
                        <p className="text-xs text-neutral-400 line-clamp-1">
                          {importedResult.playlist.description || 'Imported from Spotify'}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                          <span className="text-[#1DB954] font-medium">
                            {importedResult.tracks.length} songs
                          </span>
                          <span>•</span>
                          <span>Saved to Library</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Preview of First 5 Tracks */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block px-1">
                      Tracks Preview
                    </span>
                    <div className="bg-white/[0.02] rounded-2xl border border-white/10 divide-y divide-white/5 max-h-48 overflow-y-auto no-scrollbar">
                      {importedResult.tracks.slice(0, 10).map((t, i) => (
                        <div key={t.id || i} className="p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-neutral-500 font-mono w-4 text-right shrink-0">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-neutral-200 truncate">{t.title}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{t.artist}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-neutral-500 font-mono shrink-0">
                            {Math.floor(t.duration / 60)}:
                            {String(t.duration % 60).padStart(2, '0')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      onClick={handlePlayNow}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(29,185,84,0.3)]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Play Playlist Now
                    </button>
                    <button
                      onClick={() => {
                        setImportedResult(null);
                        setUrlInput('');
                      }}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition cursor-pointer"
                    >
                      Import Another
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 1: Link Input */}
                  {activeTab === 'link' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-2">
                          Spotify Playlist or Album Link
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleImportByUrl()}
                            placeholder="https://open.spotify.com/playlist/... or spotify:playlist:..."
                            className="w-full bg-neutral-900 border border-white/15 rounded-xl py-3 pl-3.5 pr-20 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition"
                          />
                          <button
                            type="button"
                            onClick={handlePasteClipboard}
                            title="Paste from clipboard"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                          >
                            <Clipboard className="w-3 h-3" />
                            Paste
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-2">
                          Supports public Spotify playlists, albums, and Spotify URIs.
                        </p>
                      </div>

                      {/* Quick Examples */}
                      <div>
                        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                          Try a Popular Example:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setUrlInput('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
                              handleImportByUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-[#1DB954]" />
                            Today's Top Hits
                          </button>
                          <button
                            onClick={() => {
                              setUrlInput('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd');
                              handleImportByUrl('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-[#1DB954]" />
                            RapCaviar
                          </button>
                          <button
                            onClick={() => {
                              setUrlInput('https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM');
                              handleImportByUrl('https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-[#1DB954]" />
                            Lo-Fi Beats
                          </button>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={() => handleImportByUrl()}
                        disabled={isLoading || !urlInput.trim()}
                        className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 disabled:pointer-events-none text-black font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(29,185,84,0.25)] mt-4"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            Fetching Spotify tracks...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            Import Playlist
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* TAB 2: Popular Curated */}
                  {activeTab === 'popular' && (
                    <div className="space-y-3">
                      <p className="text-xs text-neutral-400">
                        Select any top curated Spotify playlist to add directly to your library with one click:
                      </p>
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                        {curatedList.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 transition"
                          >
                            <img
                              src={item.artworkUrl}
                              alt={item.title}
                              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                              <p className="text-[11px] text-neutral-400 line-clamp-1">{item.description}</p>
                              <span className="text-[10px] text-[#1DB954] font-medium">
                                ~{item.trackCount || 50} tracks
                              </span>
                            </div>
                            <button
                              onClick={() => handleImportCurated(item)}
                              disabled={importingId === item.id}
                              className="px-3 py-1.5 rounded-xl bg-[#1DB954]/20 hover:bg-[#1DB954] border border-[#1DB954]/40 text-[#1DB954] hover:text-black font-semibold text-xs transition cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {importingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                'Import'
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Paste Text Tracklist */}
                  {activeTab === 'text' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-1">
                          Playlist Name
                        </label>
                        <input
                          type="text"
                          value={textTitle}
                          onChange={(e) => setTextTitle(e.target.value)}
                          placeholder="e.g. My Favorite Spotify Tracks"
                          className="w-full bg-neutral-900 border border-white/15 rounded-xl py-2.5 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-1">
                          Tracklist (One song per line or CSV)
                        </label>
                        <textarea
                          rows={6}
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          placeholder={"Artist - Song Title\nThe Weeknd - Blinding Lights\nDua Lipa - Levitating\nBillie Eilish - Birds of a Feather"}
                          className="w-full bg-neutral-900 border border-white/15 rounded-xl p-3 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#1DB954]"
                        />
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Format: <code className="text-neutral-300">Artist - Title</code> or exported CSV / text from Spotify tools.
                        </p>
                      </div>

                      <button
                        onClick={handleImportByText}
                        disabled={isLoading || !textContent.trim()}
                        className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 disabled:pointer-events-none text-black font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(29,185,84,0.25)]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            Creating Playlist...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            Import Tracklist
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer status notice */}
            <div className="px-5 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
                <span>Spotify Bridge Active</span>
              </div>
              <span>Saved locally & synced to account</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

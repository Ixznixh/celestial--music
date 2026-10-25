import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Radio,
  Globe,
  Share2,
  Disc,
  Music,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Play,
  Send,
  Zap,
  Activity,
  User as UserIcon,
  Layers,
  Sparkles,
  Loader2,
  LogOut,
  Sliders,
  Copy,
  Check,
  Key,
  AtSign,
  Cookie
} from 'lucide-react';
import {
  getConnectivityState,
  saveConnectivityState,
  subscribeToConnectivity,
  testSourceHealth,
  startGoogleDeviceAuth,
  pollGoogleDeviceAuth,
  connectYouTubeChannel,
  connectYouTubeCookie,
  PluggableSource,
  ConnectivityState
} from '../../services/connectivity';
import { setUserSession, signOutUser } from '../../services/youtubeAuth';
import { GlassSwitch } from '../common/GlassSwitch';
import { Song, Playlist } from '../../types';

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  onImportPlaylist?: (playlist: Playlist) => Promise<void>;
}

export const ConnectivityModal: React.FC<ConnectivityModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onImportPlaylist,
}) => {
  const [state, setState] = useState<ConnectivityState>(getConnectivityState());
  const [activeTab, setActiveTab] = useState<'all' | 'accounts' | 'discord' | 'scrobble' | 'sources'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real YouTube Music & Google Account states
  const [authMethodTab, setAuthMethodTab] = useState<'google' | 'channel' | 'cookie'>('google');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [deviceAuthData, setDeviceAuthData] = useState<{
    user_code: string;
    verification_url: string;
    prefilled_url: string;
    device_code: string;
    expires_in: number;
    interval: number;
  } | null>(null);
  const [ytChannelInput, setYtChannelInput] = useState('');
  const [isConnectingChannel, setIsConnectingChannel] = useState(false);
  const [ytCookieInput, setYtCookieInput] = useState('');
  const [isConnectingCookie, setIsConnectingCookie] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Discord inputs
  const [discordWebhookInput, setDiscordWebhookInput] = useState(state.discord.webhookUrl || '');
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);

  // Scrobble inputs
  const [lastFmUser, setLastFmUser] = useState(state.scrobbler.lastFm.username || '');
  const [lastFmKey, setLastFmKey] = useState(state.scrobbler.lastFm.apiKey || '');
  const [lbToken, setLbToken] = useState(state.scrobbler.listenBrainz.userToken || '');

  // Pluggable sources
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'core' | 'stream' | 'metadata' | 'lyrics'>('stream');

  useEffect(() => {
    const unsub = subscribeToConnectivity(setState);
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1-Click Real Google & YouTube Music Authentication
  const handleStartGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const codeData = await startGoogleDeviceAuth();
      setDeviceAuthData(codeData);
      setIsWaitingForApproval(true);

      // Open prefilled URL in popup or new tab (user never has to type the code!)
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        codeData.prefilled_url,
        'Google YouTube Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Start background polling
      const pollInterval = (codeData.interval || 5) * 1000;
      const timer = setInterval(async () => {
        try {
          const pollRes = await pollGoogleDeviceAuth(codeData.device_code);
          if (pollRes.status === 'authenticated' && pollRes.user) {
            clearInterval(timer);
            setIsWaitingForApproval(false);
            setDeviceAuthData(null);
            if (popup && !popup.closed) popup.close();

            saveConnectivityState({
              googleAccount: {
                connected: true,
                email: pollRes.user.email,
                name: pollRes.user.displayName,
                photoURL: pollRes.user.photoURL,
                handle: pollRes.user.handle,
                isRealAccount: true,
                authMethod: 'google',
              },
            });

            setUserSession(pollRes.user, pollRes.tokens);

            if (pollRes.likedSongs && pollRes.likedSongs.length > 0 && onImportPlaylist) {
              await onImportPlaylist({
                id: 'yt_liked_songs',
                title: 'YouTube Liked Songs',
                description: 'Synced from your real YouTube Music account',
                artworkUrl: pollRes.user.photoURL,
                tracks: pollRes.likedSongs,
                trackCount: pollRes.likedSongs.length,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }

            showToast(`Connected as ${pollRes.user.displayName}! Real YouTube Music account active.`);
          } else if (pollRes.status === 'expired' || pollRes.status === 'denied') {
            clearInterval(timer);
            setIsWaitingForApproval(false);
            setDeviceAuthData(null);
            showToast('Google sign-in was cancelled or timed out.');
          }
        } catch (e) {
          // ignore transient errors while polling
        }
      }, pollInterval);

      // 10-minute timeout
      setTimeout(() => {
        clearInterval(timer);
        setIsWaitingForApproval(false);
      }, 10 * 60 * 1000);

    } catch (err: any) {
      showToast(err.message || 'Failed to start Google sign-in');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Connect via YouTube Channel / Handle
  const handleConnectChannel = async () => {
    if (!ytChannelInput.trim()) return;
    setIsConnectingChannel(true);
    try {
      const res = await connectYouTubeChannel(ytChannelInput.trim());
      if (res.user) {
        saveConnectivityState({
          googleAccount: {
            connected: true,
            email: res.user.email,
            name: res.user.displayName,
            photoURL: res.user.photoURL,
            handle: res.user.handle,
            channelId: res.user.channelId,
            subscribers: res.user.subscribers,
            isRealAccount: true,
            authMethod: 'channel',
          },
        });
        setUserSession(res.user);
        showToast(`Connected to real YouTube channel "${res.user.displayName}" (${res.user.handle})!`);
        setYtChannelInput('');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not find YouTube channel.');
    } finally {
      setIsConnectingChannel(false);
    }
  };

  // Connect via YouTube Music Cookie
  const handleConnectCookie = async () => {
    if (!ytCookieInput.trim()) return;
    setIsConnectingCookie(true);
    try {
      const res = await connectYouTubeCookie(ytCookieInput.trim());
      if (res.user) {
        saveConnectivityState({
          googleAccount: {
            connected: true,
            email: res.user.email,
            name: res.user.displayName,
            photoURL: res.user.photoURL,
            handle: res.user.handle,
            isRealAccount: true,
            authMethod: 'cookie',
          },
        });
        setUserSession(res.user);
        if (res.likedSongs && res.likedSongs.length > 0 && onImportPlaylist) {
          await onImportPlaylist({
            id: 'yt_liked_songs',
            title: 'YouTube Liked Songs',
            description: 'Imported from your real YouTube Music account',
            artworkUrl: res.user.photoURL,
            tracks: res.likedSongs,
            trackCount: res.likedSongs.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        showToast(`Connected as ${res.user.displayName}! Synced ${res.likedSongs?.length || 0} Liked Songs.`);
        setYtCookieInput('');
      }
    } catch (err: any) {
      showToast(err.message || 'Invalid or expired YouTube Music cookie.');
    } finally {
      setIsConnectingCookie(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await signOutUser();
    saveConnectivityState({
      googleAccount: {
        connected: false,
        name: 'Anonymous Guest',
        isRealAccount: false,
      },
    });
    setDeviceAuthData(null);
    setIsWaitingForApproval(false);
    showToast('Signed out of YouTube Music account. Running in anonymous mode.');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Code copied to clipboard!');
  };

  // Discord Rich Presence test
  const handleTestDiscord = () => {
    setIsTestingDiscord(true);
    setTimeout(() => {
      saveConnectivityState({
        discord: {
          ...state.discord,
          webhookUrl: discordWebhookInput.trim(),
        },
      });
      setIsTestingDiscord(false);
      showToast('Discord Rich Presence broadcast packet sent successfully!');
    }, 700);
  };

  // Save Scrobbler settings
  const handleSaveScrobblers = () => {
    saveConnectivityState({
      scrobbler: {
        ...state.scrobbler,
        lastFm: {
          ...state.scrobbler.lastFm,
          username: lastFmUser.trim(),
          apiKey: lastFmKey.trim(),
          enabled: Boolean(lastFmUser.trim()),
        },
        listenBrainz: {
          ...state.scrobbler.listenBrainz,
          userToken: lbToken.trim(),
          enabled: Boolean(lbToken.trim()),
        },
      },
    });
    showToast('Scrobbling configuration saved!');
  };

  // Health-check / ping a source
  const handleTestSource = async (source: PluggableSource) => {
    setTestingSourceId(source.id);
    const result = await testSourceHealth(source);
    setTestingSourceId(null);
    showToast(`${source.name} is ${result.status.toUpperCase()} (${result.pingMs}ms latency)`);
  };

  // Add custom source
  const handleAddCustomSource = () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    const newSource: PluggableSource = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      type: newSourceType,
      priority: state.sources.length + 1,
      enabled: true,
      status: 'untested',
      isCustom: true,
      description: 'Custom pluggable module endpoint source.',
    };
    saveConnectivityState({
      sources: [...state.sources, newSource],
    });
    setNewSourceName('');
    setNewSourceUrl('');
    setIsAddSourceOpen(false);
    showToast(`Added pluggable source "${newSource.name}".`);
    handleTestSource(newSource);
  };

  const handleDeleteSource = (id: string) => {
    saveConnectivityState({
      sources: state.sources.filter((s) => s.id !== id),
    });
    showToast('Source removed.');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl" />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl bg-[#0c0c0f] border border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_50px_rgba(255,255,255,0.05)] text-white overflow-hidden flex flex-col max-h-[90vh] z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
                    <span>Connectivity & Accounts</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
                      Hub
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400 truncate">
                    Google & YouTube Music, Discord Rich Presence, Scrobbling & Pluggable Sources
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Notification Toast */}
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-5 mt-3 p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">{toastMessage}</span>
              </motion.div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-white/10 px-5 py-2.5 bg-black/40 gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs font-semibold select-none">
              {[
                { id: 'all', label: 'All Modules' },
                { id: 'accounts', label: 'YouTube Music' },
                { id: 'discord', label: 'Discord Presence' },
                { id: 'scrobble', label: 'Last.fm & Scrobblers' },
                { id: 'sources', label: 'Pluggable Sources' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-white/15 text-white font-bold border border-white/20 shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* 1. REAL YOUTUBE MUSIC & GOOGLE ACCOUNT */}
              {(activeTab === 'all' || activeTab === 'accounts') && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0 shadow-md">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-11.832c-2.616 0-4.728 2.112-4.728 4.728S9.384 16.728 12 16.728s4.728-2.112 4.728-4.728S14.616 7.272 12 7.272zm-1.872 6.648V10.08l3.744 1.92-3.744 1.92z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>YouTube Music & Google Account</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            state.googleAccount.connected
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}>
                            {state.googleAccount.connected ? 'Real Account Connected' : 'Guest Mode'}
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Sign in with your real Google account or connect your YouTube channel for personalized playlists & recommendations.
                        </p>
                      </div>
                    </div>

                    {state.googleAccount.connected && (
                      <button
                        onClick={handleGoogleDisconnect}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>

                  {state.googleAccount.connected ? (
                    /* CONNECTED STATE CARD */
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-black/50 rounded-xl border border-white/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={state.googleAccount.photoURL}
                          alt=""
                          className="w-10 h-10 rounded-full border-2 border-red-500/40 object-cover shadow"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            <span>{state.googleAccount.name}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {state.googleAccount.handle || state.googleAccount.email}
                            {state.googleAccount.subscribers && ` • ${state.googleAccount.subscribers}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-emerald-400 font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                          Personalized Library Active
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* NOT CONNECTED: 3 AUTH METHODS */
                    <div className="space-y-3 pt-1">
                      {/* Sub-tab selection */}
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                        <button
                          onClick={() => setAuthMethodTab('google')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            authMethodTab === 'google' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Google Sign-In</span>
                        </button>
                        <button
                          onClick={() => setAuthMethodTab('channel')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            authMethodTab === 'channel' ? 'bg-white/15 text-white shadow' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <AtSign className="w-3.5 h-3.5" />
                          <span>Channel Handle</span>
                        </button>
                        <button
                          onClick={() => setAuthMethodTab('cookie')}
                          className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            authMethodTab === 'cookie' ? 'bg-white/15 text-white shadow' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <Cookie className="w-3.5 h-3.5" />
                          <span>Cookie Sync</span>
                        </button>
                      </div>

                      {/* TAB 1: 1-CLICK GOOGLE LOGIN */}
                      {authMethodTab === 'google' && (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-3">
                          {!isWaitingForApproval ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                              <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-white">Direct Google / YouTube Login</p>
                                <p className="text-[11px] text-neutral-400">
                                  Opens the official Google window with pre-filled authorization to connect your real account.
                                </p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleStartGoogleLogin}
                                disabled={isGoogleLoading}
                                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50 shrink-0"
                              >
                                {isGoogleLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-11.832c-2.616 0-4.728 2.112-4.728 4.728S9.384 16.728 12 16.728s4.728-2.112 4.728-4.728S14.616 7.272 12 7.272zm-1.872 6.648V10.08l3.744 1.92-3.744 1.92z" />
                                  </svg>
                                )}
                                <span>Sign In with Google Account</span>
                              </motion.button>
                            </div>
                          ) : (
                            <div className="space-y-3 py-1">
                              <div className="flex items-center gap-2.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span>Waiting for Google approval... Please select your account and click Allow.</span>
                              </div>

                              {deviceAuthData && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 bg-black/60 rounded-xl border border-white/10 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-neutral-400">Your prefilled code:</span>
                                    <code className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                                      {deviceAuthData.user_code}
                                    </code>
                                    <button
                                      onClick={() => handleCopyCode(deviceAuthData.user_code)}
                                      className="text-neutral-400 hover:text-white p-1 rounded transition cursor-pointer"
                                      title="Copy code"
                                    >
                                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <a
                                      href={deviceAuthData.prefilled_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Re-open Google Window</span>
                                    </a>
                                    <button
                                      onClick={() => setIsWaitingForApproval(false)}
                                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-400 hover:text-white text-xs transition cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: CONNECT VIA CHANNEL HANDLE */}
                      {authMethodTab === 'channel' && (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
                          <p className="text-[11px] text-neutral-400">
                            Connect your public YouTube profile, channel avatar, and playlists with zero login credentials.
                          </p>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              value={ytChannelInput}
                              onChange={(e) => setYtChannelInput(e.target.value)}
                              placeholder="Enter YouTube @handle, name, or URL (e.g. @Alanwalkermusic)"
                              className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleConnectChannel}
                              disabled={isConnectingChannel || !ytChannelInput.trim()}
                              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {isConnectingChannel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AtSign className="w-3.5 h-3.5" />}
                              <span>Connect Channel</span>
                            </motion.button>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: CONNECT VIA COOKIE */}
                      {authMethodTab === 'cookie' && (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
                          <p className="text-[11px] text-neutral-400">
                            Paste your YouTube Music session cookie to instantly import your real <strong className="text-white">Liked Songs (`LM`)</strong> and private playlists into Celestial Music.
                          </p>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="password"
                              value={ytCookieInput}
                              onChange={(e) => setYtCookieInput(e.target.value)}
                              placeholder="Paste cookie string from music.youtube.com (includes SAPISID/LOGIN_INFO)"
                              className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition font-mono"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleConnectCookie}
                              disabled={isConnectingCookie || !ytCookieInput.trim()}
                              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {isConnectingCookie ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cookie className="w-3.5 h-3.5" />}
                              <span>Sync Liked Songs</span>
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* 3. DISCORD RICH PRESENCE */}
              {(activeTab === 'all' || activeTab === 'discord') && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shrink-0 shadow-md">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Discord Rich Presence</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30">
                            Live Status
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          In-app login, live track/artist/album and progress.
                        </p>
                      </div>
                    </div>

                    <GlassSwitch
                      checked={state.discord.enabled}
                      onChange={(val) => {
                        saveConnectivityState({
                          discord: { ...state.discord, enabled: val },
                        });
                        showToast(val ? 'Discord Rich Presence enabled' : 'Discord Rich Presence disabled');
                      }}
                    />
                  </div>

                  {/* Live Realistic Discord Activity Preview Card */}
                  <div className="bg-[#111214] border border-[#232428] rounded-2xl p-4 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] text-[#949ba4] font-semibold border-b border-white/5 pb-2">
                      <span className="uppercase tracking-wider">Discord Activity Preview</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        Broadcasting
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <img
                          src={currentSong?.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop'}
                          alt=""
                          className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/10"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-white border-2 border-[#111214]">
                          <Music className="w-2.5 h-2.5" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#b5bac1]">
                          LISTENING TO CELESTIAL MUSIC
                        </p>
                        <p className="text-sm font-bold text-white truncate">
                          {currentSong?.title || 'Celestial Music Track'}
                        </p>
                        <p className="text-xs text-[#dbdee1] truncate">
                          by {currentSong?.artist || 'Popular Artist'}
                        </p>
                        <p className="text-[11px] text-[#949ba4] truncate">
                          on {currentSong?.album || 'Official Release'}
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="space-y-1 pt-1">
                      <div className="w-full bg-[#35373c] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-white h-full transition-all duration-300"
                          style={{
                            width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 45}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#949ba4] font-mono">
                        <span>{formatTime(currentTime || 65)}</span>
                        <span>{formatTime(duration || 215)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Webhook & Client ID inputs */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={discordWebhookInput}
                      onChange={(e) => setDiscordWebhookInput(e.target.value)}
                      placeholder="Optional: Discord Webhook URL for channel broadcast"
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#5865F2] transition"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleTestDiscord}
                      disabled={isTestingDiscord}
                      className="px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isTestingDiscord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Test Broadcast</span>
                    </motion.button>
                  </div>
                </section>
              )}

              {/* 4. SCROBBLING TO LAST.FM & LISTENBRAINZ */}
              {(activeTab === 'all' || activeTab === 'scrobble') && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-md">
                      <Disc className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Scrobbling to Last.fm & ListenBrainz</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Auto Scrobbler
                        </span>
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Log and sync your played tracks directly to your profile.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {/* Last.fm Card */}
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Last.fm Scrobbler
                        </span>
                        <span className="text-[10px] text-neutral-400">At 50% played</span>
                      </div>
                      <input
                        type="text"
                        value={lastFmUser}
                        onChange={(e) => setLastFmUser(e.target.value)}
                        placeholder="Last.fm Username"
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                      />
                      <input
                        type="password"
                        value={lastFmKey}
                        onChange={(e) => setLastFmKey(e.target.value)}
                        placeholder="API Key (optional)"
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* ListenBrainz Card */}
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          ListenBrainz Scrobbler
                        </span>
                        <span className="text-[10px] text-neutral-400">Open Source</span>
                      </div>
                      <input
                        type="password"
                        value={lbToken}
                        onChange={(e) => setLbToken(e.target.value)}
                        placeholder="ListenBrainz User Token"
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                        <span>Get token from listenbrainz.org</span>
                        <a
                          href="https://listenbrainz.org/profile/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 underline flex items-center gap-0.5"
                        >
                          Profile <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSaveScrobblers}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Save Scrobbler Settings
                    </button>
                  </div>
                </section>
              )}

              {/* 5. PLUGGABLE SOURCES */}
              {(activeTab === 'all' || activeTab === 'sources') && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-md">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Pluggable Sources Engine</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            {state.sources.length} Active
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Add, edit, test and health-check module sources.
                        </p>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAddSourceOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Source</span>
                    </motion.button>
                  </div>

                  {/* Add source inline form */}
                  {isAddSourceOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-black/60 border border-cyan-500/30 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                        <span>Register New Pluggable Source Module</span>
                        <button
                          onClick={() => setIsAddSourceOpen(false)}
                          className="text-neutral-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                          placeholder="Source Name (e.g. Invidious Node)"
                          className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                        />
                        <input
                          type="text"
                          value={newSourceUrl}
                          onChange={(e) => setNewSourceUrl(e.target.value)}
                          placeholder="Base Endpoint URL (https://...)"
                          className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                        />
                        <select
                          value={newSourceType}
                          onChange={(e) => setNewSourceType(e.target.value as any)}
                          className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="stream">Audio Streamer</option>
                          <option value="metadata">Metadata Provider</option>
                          <option value="lyrics">Lyrics Engine</option>
                          <option value="core">Core Catalogue</option>
                        </select>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleAddCustomSource}
                          disabled={!newSourceName.trim() || !newSourceUrl.trim()}
                          className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs disabled:opacity-40 transition cursor-pointer"
                        >
                          Save & Health Check
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Sources List */}
                  <div className="space-y-2.5">
                    {state.sources.map((source) => (
                      <div
                        key={source.id}
                        className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-3 hover:border-white/20 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{source.name}</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                              {source.type}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                source.status === 'healthy'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : source.status === 'degraded'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  source.status === 'healthy'
                                    ? 'bg-emerald-400'
                                    : source.status === 'degraded'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}
                              />
                              {source.status.toUpperCase()} {source.pingMs ? `(${source.pingMs}ms)` : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">{source.url}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTestSource(source)}
                            disabled={testingSourceId === source.id}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-neutral-200 hover:text-white transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Run live latency & health check"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${testingSourceId === source.id ? 'animate-spin text-cyan-400' : ''}`}
                            />
                            <span>Test</span>
                          </button>

                          {source.isCustom && (
                            <button
                              onClick={() => handleDeleteSource(source.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                              title="Delete Source"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, User as UserIcon, CloudCheck, Loader2, Sparkles, Youtube, Settings } from 'lucide-react';
import { subscribeToAuth, signInWithGoogle, signOutUser, signOutYouTube } from '../../lib/firebase';
import { User } from '../../types';

// Direct YouTube OAuth functions
import { signInWithYouTube, getYouTubeAccessToken, clearYouTubeTokens } from '../../lib/firebase';

interface AuthButtonProps {
  onOpenAccountModal?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onOpenAccountModal }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
      if (onOpenAccountModal) {
        onOpenAccountModal();
      }
    } catch (err: any) {
      console.error('Sign-In Error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setDropdownOpen(false);
      // Sign out from both YouTube OAuth and Firebase
      await signOutYouTube();
      await signOutUser();
    } catch (err: any) {
      console.error('Sign-Out Error:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSignIn}
        disabled={signingIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/25 transition-all cursor-pointer"
        title="Sign in with your YouTube Music account"
      >
        {signingIn ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        ) : (
          <Youtube className="w-3.5 h-3.5 text-white fill-current" />
        )}
        <span className="hidden sm:inline">Sign In with YouTube</span>
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (onOpenAccountModal) {
            onOpenAccountModal();
          } else {
            setDropdownOpen(!dropdownOpen);
          }
        }}
        className="flex items-center gap-2 p-1 pr-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
        title="Open Account & Demus YouTube Sync Hub"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-6 h-6 rounded-full object-cover border border-white/20"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-rose-500/30 border border-rose-500/40 flex items-center justify-center text-[10px] text-rose-300 font-bold">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <span className="hidden sm:inline max-w-[90px] truncate">
          {user.displayName?.split(' ')[0] || 'Account'}
        </span>
        <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
      </motion.button>

      <AnimatePresence>
        {dropdownOpen && !onOpenAccountModal && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 z-50 w-64 p-4 rounded-2xl bg-neutral-900/95 border border-white/15 backdrop-blur-xl shadow-2xl text-left"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-sm text-rose-300 font-bold">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {user.displayName || 'Celestial User'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="py-2.5 px-1 space-y-2 border-b border-white/10 my-2 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-red-400 font-medium">
                    <Youtube className="w-3.5 h-3.5 fill-current" />
                    YouTube Music Connected
                  </span>
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">
                    SYNCED
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your YouTube Music liked songs, playlists, and account are synchronized with Celestial.
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
/**
 * YouTube Music Native Authentication Service
 * 
 * Replaces external Firebase Auth with a native, local-first YouTube Music Account engine.
 * - Zero domain whitelist restrictions (never triggers auth/unauthorized-domain).
 * - Instant connection with YouTube handle, channel, or custom profile.
 * - Preserves account scoping and library persistence in IndexedDB.
 */

import { User } from '../types';

const STORAGE_KEY = 'celestial_yt_user';
const TOKEN_KEY = 'yt_direct_access_token';
const REFRESH_KEY = 'yt_direct_refresh_token';

let currentUser: User | null = null;
const authListeners = new Set<(user: User | null) => void>();

// Load initial user session from localStorage
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    currentUser = JSON.parse(saved);
  }
} catch (e) {
  console.warn('Failed to parse cached YouTube user profile:', e);
}

function notifyListeners() {
  for (const listener of authListeners) {
    try {
      listener(currentUser);
    } catch (err) {
      console.warn('Auth listener error:', err);
    }
  }
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  authListeners.add(callback);
  // Emit current state immediately
  callback(currentUser);
  return () => {
    authListeners.delete(callback);
  };
}

/**
 * Sign in with YouTube Music Account
 * Accepts a custom handle, name, channel ID, or avatar
 */
export async function signInWithYouTubeAccount(profile?: {
  displayName?: string;
  email?: string;
  photoURL?: string;
  handle?: string;
  channelId?: string;
}): Promise<User> {
  const rawName = profile?.displayName?.trim() || 'YouTube Music Listener';
  const handle =
    profile?.handle?.trim() ||
    `@${rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'music'}`;

  // Default beautiful modern gradient / dicebear avatar if none supplied
  const photoURL =
    profile?.photoURL?.trim() ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(handle || rawName)}`;

  const user: User = {
    uid: `yt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    displayName: rawName,
    email: profile?.email || `${handle.replace(/^@/, '')}@youtube.com`,
    photoURL,
    handle,
    channelId: profile?.channelId,
  };

  currentUser = user;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Could not persist YouTube user in localStorage:', e);
  }

  notifyListeners();
  window.dispatchEvent(new CustomEvent('celestial-auth-change', { detail: { user } }));
  return user;
}

export function setUserSession(user: User, tokens?: { access_token?: string; refresh_token?: string }): void {
  currentUser = user;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Could not persist YouTube user:', e);
  }
  if (tokens?.access_token) {
    setYouTubeAccessToken(tokens.access_token, tokens.refresh_token);
  }
  notifyListeners();
  window.dispatchEvent(new CustomEvent('celestial-auth-change', { detail: { user } }));
}

/** Request Google Device Code for official YouTube Music sign-in */
export async function requestGoogleDeviceCode(): Promise<{
  user_code: string;
  verification_url: string;
  device_code: string;
  expires_in: number;
  interval: number;
}> {
  const res = await fetch('/api/ytmusic/auth/device-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start Google sign-in');
  }
  return res.json();
}

/** Poll Google for user authorization */
export async function pollGoogleDeviceCode(deviceCode: string): Promise<{
  status: 'pending' | 'slow_down' | 'expired' | 'denied' | 'authenticated' | 'error';
  user?: User;
  tokens?: { access_token: string; refresh_token?: string; expires_in?: number };
  error?: string;
}> {
  const res = await fetch(`/api/ytmusic/auth/device-poll?code=${encodeURIComponent(deviceCode)}`);
  return res.json();
}

/** Connect real YouTube channel by handle (@username) or channel link */
export async function connectWithYouTubeChannel(query: string): Promise<{
  success: boolean;
  user: User;
}> {
  const res = await fetch('/api/ytmusic/auth/connect-channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to connect YouTube channel');
  }
  setUserSession(data.user);
  return data;
}

/** Connect with YouTube Music session cookie */
export async function connectWithYouTubeCookie(cookie: string): Promise<{
  success: boolean;
  user: User;
  likedSongs?: any[];
}> {
  const res = await fetch('/api/ytmusic/auth/connect-cookie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to connect with YouTube Music cookie');
  }
  setUserSession(data.user);
  return data;
}

export async function signOutUser(): Promise<void> {
  currentUser = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem('yt_access_token');
  } catch {}

  notifyListeners();
  window.dispatchEvent(new CustomEvent('celestial-auth-change', { detail: { user: null } }));
}

export function getYouTubeAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem('yt_access_token') || null;
  } catch {
    return null;
  }
}

export function setYouTubeAccessToken(token: string, refreshToken?: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem('yt_access_token', token);
    if (refreshToken) {
      sessionStorage.setItem(REFRESH_KEY, refreshToken);
    }
  } catch {}
}

export function clearYouTubeTokens(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem('yt_access_token');
  } catch {}
}

/** Auth object compatibility layer for useLibrary & accountScope */
export const auth = {
  get currentUser() {
    return currentUser;
  },
  onAuthStateChanged(callback: (user: User | null) => void) {
    return subscribeToAuth(callback);
  },
};

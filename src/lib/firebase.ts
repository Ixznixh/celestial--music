import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { Song, Playlist } from '../types';
import { toSyncSong } from '../services/accountData';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth & Firestore
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
googleProvider.addScope('https://www.googleapis.com/auth/youtube.readonly');

// ============================================================
// DIRECT YOUTUBE OAUTH (Firebase-independent)
// ============================================================

// YouTube OAuth scopes
export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

// YouTube token storage keys
export const YOUTUBE_TOKEN_STORAGE_KEY = 'yt_direct_access_token';
export const YOUTUBE_REFRESH_TOKEN_KEY = 'yt_direct_refresh_token';

// Store YouTube Access Token in sessionStorage (direct OAuth)
let youtubeAccessToken: string | null = null;
let youtubeRefreshToken: string | null = null;
let isFirestoreQuotaExhausted = false;

function handleFirestoreError(err: any, operation: string) {
  const errMsg = err?.message || String(err || '');
  const errCode = err?.code || '';
  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded')
  ) {
    if (!isFirestoreQuotaExhausted) {
      isFirestoreQuotaExhausted = true;
      console.warn(
        `Firestore quota limit reached during ${operation}. Gracefully using local storage for full offline persistence.`
      );
    }
    return;
  }
  console.warn(`Firestore ${operation} warning:`, errMsg);
}

// Get YouTube Access Token (prefers direct OAuth token, falls back to Firebase)
export function getYouTubeAccessToken(): string | null {
  // Check direct OAuth token first
  const directToken = sessionStorage.getItem(YOUTUBE_TOKEN_STORAGE_KEY);
  if (directToken) return directToken;

  // Fall back to Firebase-stored token
  return youtubeAccessToken || null;
}

// Get YouTube Refresh Token (for token refresh)
export function getYouTubeRefreshToken(): string | null {
  return sessionStorage.getItem(YOUTUBE_REFRESH_TOKEN_KEY) || null;
}

// Set YouTube Access Token (from direct OAuth)
export function setYouTubeAccessToken(token: string, refreshToken?: string) {
  youtubeAccessToken = token;
  if (refreshToken) {
    youtubeRefreshToken = refreshToken;
    sessionStorage.setItem(YOUTUBE_REFRESH_TOKEN_KEY, refreshToken);
  }
  sessionStorage.setItem(YOUTUBE_TOKEN_STORAGE_KEY, token);
}

// Clear YouTube Tokens
export function clearYouTubeTokens() {
  youtubeAccessToken = null;
  youtubeRefreshToken = null;
  sessionStorage.removeItem(YOUTUBE_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(YOUTUBE_REFRESH_TOKEN_KEY);
}

// YouTube OAuth 2.0 flow - opens popup for user to authenticate with Google
export async function signInWithYouTube(): Promise<{ success: boolean; message: string }> {
  try {
    // Build the OAuth URL with required parameters
    const clientId = (firebaseConfig as any).oAuthClientId || '';
    const redirectUri = `${window.location.origin}/api/spotify/callback`; // Using Spotify callback as placeholder, adjust as needed

    // Note: For YouTube OAuth, we need to use Google's OAuth endpoint
    // This is a simplified implementation - full OAuth flow requires
    // proper Google Cloud Console setup

    // For now, open Google's OAuth consent screen
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', window.location.origin + '/api/youtube/callback');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', YOUTUBE_OAUTH_SCOPES.join(' '));
    oauthUrl.searchParams.set('access_type', 'offline');
    oauthUrl.searchParams.set('prompt', 'consent');
    oauthUrl.searchParams.set('include_granted_scopes', 'true');
    oauthUrl.searchParams.set('state', 'celestial-music');

    // Open in popup window
    const popupWidth = 600;
    const popupHeight = 600;
    const left = (window.screen.width / 2) - (popupWidth / 2);
    const top = (window.screen.height / 2) - (popupHeight / 2);

    const popup = window.open(
      oauthUrl.toString(),
      'YouTubeAuth',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},menubar=no,toolbar=no,status=no`
    );

    if (!popup) {
      return { success: false, message: 'Pop-up blocked. Please allow pop-ups for this site.' };
    }

    // Wait for the popup to complete and handle the callback
    // The actual token exchange happens in the callback handler
    // For this implementation, we'll set up a message listener

    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        // Check if message is from our popup and contains tokens
        if (
          event.origin !== window.location.origin ||
          !event.data?.type ||
          event.data.type !== 'youtube-oauth-callback'
        ) {
          return;
        }

        // Remove the listener once handled
        window.removeEventListener('message', messageHandler);

        const { success, accessToken, refreshToken, error } = event.data;

        if (success && accessToken) {
          setYouTubeAccessToken(accessToken, refreshToken);
          resolve({ success: true, message: 'Successfully signed in with YouTube!' });
        } else {
          resolve({ success: false, message: error || 'YouTube sign-in failed' });
        }
      };

      window.addEventListener('message', messageHandler);

      // Set a timeout to handle case user closes popup without completing
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        resolve({ success: false, message: 'YouTube sign-in timed out' });
      }, 10000);
    });
  } catch (err: any) {
    console.error('YouTube Sign-In failed:', err);
    return { success: false, message: err.message || 'YouTube sign-in error' };
  }
}

// Exchange authorization code for tokens (called from callback page)
export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const params = new URLSearchParams({
    code: code,
    client_id: (firebaseConfig as any).oAuthClientId || '',
    client_secret: (firebaseConfig as any).apiKey || '', // Note: API key is not client secret
    redirect_uri: window.location.origin + '/api/youtube/callback',
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${errorData.error || 'Unknown error'}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
  };
}

// Refresh YouTube access token using refresh token
export async function refreshYouTubeToken(refreshToken: string): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: (firebaseConfig as any).oAuthClientId || '',
    client_secret: (firebaseConfig as any).apiKey || '', // Note: May need proper client secret
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token refresh failed: ${errorData.error || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.access_token || '';
}

// Sign out from YouTube (revoke tokens)
export async function signOutYouTube(): Promise<void> {
  try {
    // Revoke the access token
    const accessToken = getYouTubeAccessToken();
    if (accessToken) {
      const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${accessToken}`;
      await fetch(revokeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    clearYouTubeTokens();
  } catch (err) {
    console.error('YouTube sign-out error:', err);
    // Still clear local tokens even if revocation fails
    clearYouTubeTokens();
  }
}

// ============================================================
// EXISTING FIREBASE GOOGLE SIGN-IN (kept for backward compatibility)
// ============================================================

// Store YouTube Access Token in memory (from Firebase)
let firebaseYoutubeAccessToken: string | null = null;
let isFirebaseQuotaExhausted = false;

function handleFirebaseFirestoreError(err: any, operation: string) {
  const errMsg = err?.message || String(err || '');
  const errCode = err?.code || '';
  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded')
  ) {
    if (!isFirebaseQuotaExhausted) {
      isFirebaseQuotaExhausted = true;
      console.warn(
        `Firebase Firestore quota limit reached during ${operation}. Gracefully using local storage for full offline persistence.`
      );
    }
    return;
  }
  console.warn(`Firebase Firestore ${operation} warning:`, errMsg);
}

export function getFirebaseYouTubeAccessToken(): string | null {
  return firebaseYoutubeAccessToken || sessionStorage.getItem('yt_access_token');
}

export function setFirebaseYouTubeAccessToken(token: string | null) {
  firebaseYoutubeAccessToken = token;
  if (token) {
    sessionStorage.setItem('yt_access_token', token);
  }
}

// Sign in with Google Auth Popup
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;

    if (accessToken) {
      firebaseYoutubeAccessToken = accessToken;
      setYouTubeAccessToken(accessToken);
      sessionStorage.setItem('yt_access_token', accessToken);
    }

    if (result.user && !isFirebaseQuotaExhausted) {
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            id: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err: any) {
        handleFirebaseFirestoreError(err, 'user profile sync');
      }
    }
    return { user: result.user, accessToken };
  } catch (err: any) {
    console.error('Google Sign-In failed:', err);
    throw err;
  }
}

// Sign out function
export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('Sign-Out failed:', err);
    throw err;
  }
}

// Auth State Listener Hook Helper
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/* ----------------- FIRESTORE SYNC HELPERS ----------------- */

// (All the Firestore sync helpers remain the same as before)
// Sync User Favorites with Firestore
export async function syncFavoriteToFirestore(userId: string, song: Song, isFavorite: boolean): Promise<void> {
  if (!userId || isFirebaseQuotaExhausted) return;
  const favoriteDocId = `${userId}_${song.id}`;
  const favRef = doc(db, 'user_favorites', favoriteDocId);

  try {
    if (isFavorite) {
      await setDoc(favRef, {
        id: favoriteDocId,
        userId,
        songId: song.id,
        song,
        addedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(favRef);
    }
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'favorite sync');
  }
}

// Fetch User Favorites from Firestore
export async function fetchUserFavoritesFromFirestore(userId: string): Promise<Song[]> {
  if (!userId || isFirebaseQuotaExhausted) return [];
  try {
    const favsRef = collection(db, 'user_favorites');
    const q = query(favsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const songs: Song[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.song) {
        songs.push(data.song as Song);
      }
    });
    return songs;
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'favorites fetch');
    return [];
  }
}

// Sync User Playlists with Firestore
export async function syncPlaylistToFirestore(userId: string, playlist: Playlist): Promise<void> {
  if (!userId || isFirebaseQuotaExhausted) return;
  const playlistRef = doc(db, 'user_playlists', playlist.id);
  try {
    await setDoc(playlistRef, {
      ...playlist,
      userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'playlist sync');
  }
}

// Delete Playlist from Firestore
export async function deletePlaylistFromFirestore(playlistId: string): Promise<void> {
  if (!playlistId || isFirebaseQuotaExhausted) return;
  try {
    const playlistRef = doc(db, 'user_playlists', playlistId);
    await deleteDoc(playlistRef);
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'playlist delete');
  }
}

// Fetch User Playlists from Firestore
export async function fetchUserPlaylistsFromFirestore(userId: string): Promise<Playlist[]> {
  if (!userId || isFirebaseQuotaExhausted) return [];
  try {
    const playlistsRef = collection(db, 'user_playlists');
    const q = query(playlistsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const playlists: Playlist[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        playlists.push(data as Playlist);
      }
    });
    return playlists;
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'playlists fetch');
    return [];
  }
}

// Sync User Offline Cached Songs to Firestore
export async function syncCachedSongToFirestore(userId: string, song: Song, isCached: boolean): Promise<void> {
  if (!userId || isFirebaseQuotaExhausted) return;
  const cacheDocId = `${userId}_${song.id}`;
  const cacheRef = doc(db, 'user_cached_songs', cacheDocId);

  try {
    if (isCached) {
      await setDoc(cacheRef, {
        id: cacheDocId,
        userId,
        songId: song.id,
        song,
        cachedAt: Date.now(),
      });
    } else {
      await deleteDoc(cacheRef);
    }
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'cached song sync');
  }
}

// Fetch User Offline Cached Songs from Firestore
export async function fetchUserCachedSongsFromFirestore(userId: string): Promise<Song[]> {
  if (!userId || isFirebaseQuotaExhausted) return [];
  try {
    const cacheRef = collection(db, 'user_cached_songs');
    const q = query(cacheRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const songs: Song[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.song) {
        songs.push(data.song as Song);
      }
    });
    return songs;
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'cached songs fetch');
    return [];
  }
}

/* ----------------- LISTENING HISTORY & TASTE (one document per account) ----------------- */

export interface ListeningSnapshot {
  recents: (Song & { playedAt?: number })[];
  playStats: Record<string, any> | null;
}

export async function syncListeningDataToFirestore(
  userId: string,
  recents: (Song & { playedAt?: number })[],
  playStats: Record<string, any>
): Promise<void> {
  if (!userId || isFirebaseQuotaExhausted) return;
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        recentlyPlayed: (recents || []).map((entry) => ({
          ...toSyncSong(entry),
          playedAt: entry.playedAt || Date.now(),
        })),
        playStats: playStats || {},
        listeningUpdatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'listening sync');
  }
}

export async function fetchListeningDataFromFirestore(userId: string): Promise<ListeningSnapshot | null> {
  if (!userId || isFirebaseQuotaExhausted) return null;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const recents = Array.isArray(data.recentlyPlayed) ? (data.recentlyPlayed as Song[]) : [];
    const playStats =
      data.playStats && typeof data.playStats === 'object'
        ? (data.playStats as Record<string, any>)
        : null;
    return { recents, playStats };
  } catch (err: any) {
    handleFirebaseFirestoreError(err, 'listening fetch');
    return null;
  }
}
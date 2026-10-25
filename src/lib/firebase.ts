/**
 * YouTube Music Native Auth & Storage Layer
 * 
 * Completely decoupled from Firebase SDK to eliminate auth/unauthorized-domain errors.
 * Uses local-first IndexedDB and local storage with account scoping.
 */

import { Song, Playlist, User } from '../types';
import {
  auth,
  subscribeToAuth,
  signInWithYouTubeAccount,
  signOutUser,
  getYouTubeAccessToken,
  setYouTubeAccessToken,
  clearYouTubeTokens,
} from '../services/youtubeAuth';

export { auth, subscribeToAuth, signOutUser, getYouTubeAccessToken, setYouTubeAccessToken, clearYouTubeTokens };
export type { User };

// Stand-in db export for legacy callers
export const db: any = {};

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

export const YOUTUBE_TOKEN_STORAGE_KEY = 'yt_direct_access_token';
export const YOUTUBE_REFRESH_TOKEN_KEY = 'yt_direct_refresh_token';

export async function signInWithYouTube(profile?: {
  displayName?: string;
  handle?: string;
  email?: string;
  photoURL?: string;
}): Promise<{ success: boolean; message: string; user?: User }> {
  try {
    const user = await signInWithYouTubeAccount(profile);
    return { success: true, message: 'Signed in with YouTube Music!', user };
  } catch (err: any) {
    return { success: false, message: err.message || 'YouTube sign-in error' };
  }
}

export async function signInWithGoogle(profile?: {
  displayName?: string;
  handle?: string;
  email?: string;
  photoURL?: string;
}): Promise<{ user: User; accessToken: string | null }> {
  const user = await signInWithYouTubeAccount(profile);
  return { user, accessToken: getYouTubeAccessToken() };
}

export async function signOutYouTube(): Promise<void> {
  await signOutUser();
}

export function getYouTubeRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(YOUTUBE_REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForTokens(_code: string): Promise<{ accessToken: string; refreshToken: string }> {
  return { accessToken: '', refreshToken: '' };
}

export async function refreshYouTubeToken(_refreshToken: string): Promise<string> {
  return '';
}

export function getFirebaseYouTubeAccessToken(): string | null {
  return getYouTubeAccessToken();
}

export function setFirebaseYouTubeAccessToken(token: string | null): void {
  if (token) setYouTubeAccessToken(token);
}

// Local-first Firestore replacements (noop/local persistence to prevent any network quota failure)
export async function syncFavoriteToFirestore(_userId: string, _song: Song, _isFavorite: boolean): Promise<void> {
  // Saved cleanly in IndexedDB via useLibrary
}

export async function fetchUserFavoritesFromFirestore(_userId: string): Promise<Song[]> {
  return [];
}

export async function syncPlaylistToFirestore(_userId: string, _playlist: Playlist): Promise<void> {
  // Saved cleanly in IndexedDB via useLibrary
}

export async function deletePlaylistFromFirestore(_playlistId: string): Promise<void> {
  // Handled in IndexedDB
}

export async function fetchUserPlaylistsFromFirestore(_userId: string): Promise<Playlist[]> {
  return [];
}

export async function syncCachedSongToFirestore(_userId: string, _song: Song, _isCached: boolean): Promise<void> {
  // Handled in IndexedDB
}

export async function fetchUserCachedSongsFromFirestore(_userId: string): Promise<Song[]> {
  return [];
}

export interface ListeningSnapshot {
  recents?: (Song & { playedAt?: number })[];
  playStats?: Record<string, any>;
  updatedAt?: number;
}

export async function syncListeningDataToFirestore(
  _userId: string,
  _recents: (Song & { playedAt?: number })[],
  _playStats: Record<string, any>
): Promise<void> {
  // Handled in IndexedDB taste profile
}

export async function fetchListeningDataFromFirestore(_userId: string): Promise<ListeningSnapshot | null> {
  return null;
}
/**
 * tasteProfile.ts
 *
 * Local taste modelling for "Made For You" style shelves.
 *
 * The provider has no account and no server-side listening history, so personalisation
 * is built from what this browser actually knows: plays, favourites and recency. Every
 * number here comes from real local data — nothing is generated or simulated. The
 * resulting artist seeds are sent to the server, which runs real provider queries for
 * them; the server never receives history, only search terms.
 */

import { Song } from '../types';
import { db, isDemoItem } from './indexedDB';

export const PLAY_STATS_KEY = 'celestial_play_stats';

/** Cap so a heavy listener does not grow the store without bound. */
const MAX_TRACKED_SONGS = 400;
const MAX_COUNT_PER_SONG = 10;

export interface PlayStat {
  count: number;
  artist?: string;
  genre?: string;
  title?: string;
  lastPlayedAt: number;
}

export type PlayStats = Record<string, PlayStat>;

export interface TasteProfile {
  /** Descending by weight, normalised so the top artist is 1. */
  topArtists: { name: string; weight: number }[];
  topGenres: { name: string; weight: number }[];
  /** Artist names handed to the server as query seeds (never empty strings). */
  seedArtists: string[];
  /** Recently played songs: excluded everywhere except "Jump back in". */
  recentKeys: string[];
  recentIds: string[];
  favoriteKeys: string[];
  favoriteIds: string[];
  /** True when there is enough real history to claim a personalised shelf. */
  hasSignal: boolean;
}

export interface TasteInput {
  recent: Song[];
  favorites: Song[];
  playStats: PlayStats;
  seedLimit?: number;
}

function artistOf(song: { artist?: string; artists?: string } | null | undefined): string {
  return ((song?.artist || song?.artists || '') as string).trim();
}

/** Stable identity: title+artist survives provider id churn between sessions. */
export function normalizeSongKey(song: {
  title?: string;
  artist?: string;
  artists?: string;
} | null): string {
  const title = (song?.title || '').trim().toLowerCase();
  return `${title}:::${artistOf(song).toLowerCase()}`;
}

const UNKNOWN_NAMES = new Set(['', 'unknown', 'unknown artist', 'various artists', 'va']);

function isUsableName(name: string): boolean {
  return name.length >= 2 && name.length <= 60 && !UNKNOWN_NAMES.has(name.toLowerCase());
}

function normalizeWeights(entries: [string, number][]): { name: string; weight: number }[] {
  const usable = entries.filter(([name]) => isUsableName(name));
  const max = usable.reduce((acc, [, weight]) => Math.max(acc, weight), 0);
  if (max <= 0) return [];
  return usable
    .map(([name, weight]) => ({ name, weight: weight / max }))
    .sort((a, b) => b.weight - a.weight)
    .filter((entry, index, arr) => index === 0 || entry.name !== arr[index - 1].name);
}

/**
 * Derives the profile from raw local inputs. Pure, so tests can exercise it without a
 * browser or a database.
 */
export function deriveTasteProfile({ recent, favorites, playStats, seedLimit = 4 }: TasteInput): TasteProfile {
  const artistWeights = new Map<string, number>();
  const genreWeights = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, amount: number) => {
    if (!isUsableName(key)) return;
    map.set(key, (map.get(key) || 0) + amount);
  };

  // Recency: the newest plays weigh the most, but older ones still count.
  recent.forEach((song, index) => {
    const recency = (recent.length - index) / Math.max(recent.length, 1);
    bump(artistWeights, artistOf(song), 1.5 * recency);
    if (song.genre) bump(genreWeights, song.genre.trim(), 0.6 * recency);
  });

  // Affection: a favourite is a deliberate signal, weighted above a single play.
  favorites.forEach((song) => {
    bump(artistWeights, artistOf(song), 2);
    if (song.genre) bump(genreWeights, song.genre.trim(), 1);
  });

  // Frequency: repeated plays from the play ledger.
  let totalPlays = 0;
  Object.values(playStats || {}).forEach((stat) => {
    if (!stat) return;
    const count = Math.min(stat.count || 0, MAX_COUNT_PER_SONG);
    totalPlays += stat.count || 0;
    if (stat.artist) bump(artistWeights, stat.artist, count);
    if (stat.genre) bump(genreWeights, stat.genre, count * 0.5);
  });

  const topArtists = normalizeWeights([...artistWeights.entries()]);
  const topGenres = normalizeWeights([...genreWeights.entries()]);

  const recentKeys = recent.map(normalizeSongKey);
  const recentIds = recent.map((song) => song.id).filter(Boolean);
  const favoriteKeys = favorites.map(normalizeSongKey);
  const favoriteIds = favorites.map((song) => song.id).filter(Boolean);

  return {
    topArtists,
    topGenres,
    seedArtists: topArtists.slice(0, seedLimit).map((entry) => entry.name),
    recentKeys,
    recentIds,
    favoriteKeys,
    favoriteIds,
    hasSignal: recent.length > 0 || favorites.length > 0 || totalPlays > 0,
  };
}

/** An empty profile: no invented artists, no claims of personalisation. */
export function emptyTasteProfile(): TasteProfile {
  return {
    topArtists: [],
    topGenres: [],
    seedArtists: [],
    recentKeys: [],
    recentIds: [],
    favoriteKeys: [],
    favoriteIds: [],
    hasSignal: false,
  };
}

function lookupWeight(entries: { name: string; weight: number }[], name: string): number {
  if (!name) return 0;
  const lower = name.trim().toLowerCase();
  const match = entries.find((entry) => entry.name.toLowerCase() === lower);
  return match ? match.weight : 0;
}

/**
 * How well a song fits the listener's taste. Favourites and repeat plays dominate;
 * artist and genre matches follow. Songs that fit nothing still score 0 — they are
 * ranked lower, never hidden.
 */
export function songScore(song: Song, profile: TasteProfile): number {
  let score = 0;

  score += 3 * lookupWeight(profile.topArtists, artistOf(song));
  if (song.genre) score += 1.5 * lookupWeight(profile.topGenres, song.genre);

  const key = normalizeSongKey(song);
  if (profile.favoriteKeys.includes(key) || profile.favoriteIds.includes(song.id)) {
    score += 2;
  }

  return score;
}

/** Stable taste ranking: equal scores keep their provider relevance order. */
export function rankSongs<T extends Song>(songs: T[], profile: TasteProfile): T[] {
  return songs
    .map((song, index) => ({ song, index, score: songScore(song, profile) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.song);
}

export interface IdentifiableSong {
  id: string;
  title?: string;
  artist?: string;
  artists?: string;
}

/** Removes anything the listener just played — used outside the "Jump back in" shelf. */
export function withoutRecentlyPlayed<T extends IdentifiableSong>(items: T[], profile: TasteProfile): T[] {
  if (profile.recentKeys.length === 0 && profile.recentIds.length === 0) return items;
  const keys = new Set(profile.recentKeys);
  const ids = new Set(profile.recentIds);
  return items.filter((item) => !keys.has(normalizeSongKey(item)) && !ids.has(item.id));
}

/** First occurrence wins, so shelf order decides what the listener sees first. */
export function dedupeSongs<T extends IdentifiableSong>(items: T[], seen: Set<string> = new Set()): T[] {
  const out: T[] = [];
  for (const item of items) {
    const key = normalizeSongKey(item);
    if (seen.has(key) || seen.has(item.id)) continue;
    seen.add(key);
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/* ------------------------------- Storage ------------------------------- */

export async function getPlayStats(): Promise<PlayStats> {
  const stats = await db.getSetting<PlayStats>(PLAY_STATS_KEY, {});
  return stats && typeof stats === 'object' ? stats : {};
}

/**
 * Records one real play. Called from the player whenever a track actually starts, so
 * lock-screen plays and auto-advances count too.
 */
export async function bumpPlayCount(song: Song): Promise<void> {
  if (!song || !song.id || !song.title) return;

  try {
    const stats = await getPlayStats();
    const key = normalizeSongKey(song);
    const previous = stats[key];

    stats[key] = {
      count: (previous?.count || 0) + 1,
      artist: artistOf(song) || previous?.artist,
      genre: song.genre || previous?.genre,
      title: song.title || previous?.title,
      lastPlayedAt: Date.now(),
    };

    const entries = Object.entries(stats);
    if (entries.length > MAX_TRACKED_SONGS) {
      entries
        .sort((a, b) => (b[1]?.lastPlayedAt || 0) - (a[1]?.lastPlayedAt || 0))
        .slice(MAX_TRACKED_SONGS)
        .forEach(([key]) => delete stats[key]);
    }

    await db.saveSetting(PLAY_STATS_KEY, stats);
  } catch {
    // Taste modelling must never interfere with playback.
  }
}

/** Reads history, favourites and play counts from this browser and derives the profile. */
export async function loadTasteProfile(): Promise<TasteProfile> {
  try {
    const [recent, favorites, playStats] = await Promise.all([
      db.getRecentlyPlayed(20),
      db.getFavorites(),
      getPlayStats(),
    ]);

    return deriveTasteProfile({
      recent: (recent || []).filter((song) => song && !isDemoItem(song)),
      favorites: (favorites || []).filter((song) => song && !isDemoItem(song)),
      playStats,
    });
  } catch {
    return emptyTasteProfile();
  }
}
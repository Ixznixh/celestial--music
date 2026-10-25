/**
 * autoDownload.ts
 *
 * Keeps a listener's saved music available offline without surprising them: the policy
 * lives in one pure function (off by default, respects Wi-Fi-only, never starts while
 * offline) and the effectful half only fetches and stores bytes.
 *
 * Auto-download applies to what someone deliberately saves — albums and playlists. A
 * manual download from the track menu is never blocked by these rules: the listener
 * asked for that one song right now.
 */

import { Song } from '../types';
import { db } from './indexedDB';

export const AUTO_DOWNLOAD_KEY = 'auto_download_saved';

/** Types the Network Information API reports that mean "not on Wi-Fi". */
const CELLULAR_TYPES = new Set(['cellular', 'cellular2g', 'cellular3g', 'cellular4g', 'cellular5g', 'wimax']);

export interface NetworkFacts {
  online: boolean;
  /** navigator.connection.type when the browser exposes it, else null. */
  connectionType: string | null;
  downloadOverWifiOnly: boolean;
}

export type AutoDownloadReason = 'ok' | 'disabled' | 'offline' | 'cellular' | 'no-songs';

export interface AutoDownloadDecision {
  allowed: boolean;
  reason: AutoDownloadReason;
}

/**
 * Whether a batch of newly saved songs may be downloaded automatically.
 *
 * An unknown connection type is treated as usable: guessing "cellular" would silently
 * break auto-download in every desktop browser, which never exposes that API.
 */
export function decideAutoDownload(
  enabled: boolean,
  facts: NetworkFacts
): AutoDownloadDecision {
  if (!enabled) return { allowed: false, reason: 'disabled' };
  if (!facts.online) return { allowed: false, reason: 'offline' };
  if (
    facts.downloadOverWifiOnly &&
    facts.connectionType &&
    CELLULAR_TYPES.has(facts.connectionType.toLowerCase())
  ) {
    return { allowed: false, reason: 'cellular' };
  }
  return { allowed: true, reason: 'ok' };
}

/** Songs worth attempting: real tracks only, and never one that is already stored. */
export async function selectUndownloaded(songs: Song[]): Promise<Song[]> {
  const candidates: Song[] = [];
  for (const song of songs || []) {
    if (!song || !song.id || !song.title) continue;
    if (await db.isTrackDownloaded(song.id)) continue;
    candidates.push(song);
  }
  return candidates;
}

function currentNetworkFacts(wifiOnly: boolean): NetworkFacts {
  const connection = (navigator as any).connection;
  return {
    online: typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
    connectionType: typeof connection?.type === 'string' ? connection.type : null,
    downloadOverWifiOnly: wifiOnly,
  };
}

export async function isAutoDownloadEnabled(): Promise<boolean> {
  try {
    return await db.getSetting<boolean>(AUTO_DOWNLOAD_KEY, false);
  } catch {
    return false;
  }
}

export async function setAutoDownloadEnabled(enabled: boolean): Promise<void> {
  await db.saveSetting(AUTO_DOWNLOAD_KEY, enabled);
}

/**
 * Downloads the given songs if the listener turned auto-download on and the network
 * allows it. Two at a time: fast enough for an album, gentle enough not to compete with
 * whatever is currently streaming. Returns how many tracks were newly stored.
 */
export async function autoDownloadIfEnabled(songs: Song[]): Promise<number> {
  if (!songs || songs.length === 0) return 0;

  try {
    const [enabled, settings] = await Promise.all([
      isAutoDownloadEnabled(),
      db.getSetting<{ downloadOverWifiOnly?: boolean }>('celestial_settings', {}),
    ]);
    // The Wi-Fi-only switch lives inside the app settings document, not as its own key.
    const wifiOnly = settings?.downloadOverWifiOnly ?? true;

    const decision = decideAutoDownload(enabled, currentNetworkFacts(wifiOnly));
    if (!decision.allowed) return 0;

    const queue = await selectUndownloaded(songs);
    if (queue.length === 0) return 0;

    let stored = 0;
    let cursor = 0;
    const workers = new Array(Math.min(2, queue.length)).fill(0).map(async () => {
      while (cursor < queue.length) {
        const song = queue[cursor++];
        try {
          if (await db.downloadTrackWithProgress(song)) stored++;
        } catch (err) {
          console.warn(`Auto-download skipped ${song.id}:`, err);
        }
      }
    });
    await Promise.all(workers);
    return stored;
  } catch (err) {
    console.warn('Auto-download unavailable:', err);
    return 0;
  }
}

import { Router, Request, Response } from 'express';

// Spotify OAuth configuration
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || '';
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_SCOPES =
  'user-read-email user-read-playlist-read playlist-read-collaborative playlist-read-private';

// Featured popular Spotify playlists for instant one-click import
const CURATED_SPOTIFY_PLAYLISTS = [
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    type: 'playlist',
    title: "Today's Top Hits",
    description: 'The biggest hits right now across pop, dance and hip-hop.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DX0XUsuxWHRQd',
    type: 'playlist',
    title: 'RapCaviar',
    description: 'New music from Drake, Kendrick Lamar, Future and hip-hop icons.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002882f0fa3c1bf367ff122e283',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DX4o1oenSJRJd',
    type: 'playlist',
    title: 'All Out 2000s',
    description: 'The biggest and most memorable songs of the 2000s.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002b54203df569c73b06bc91d29',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DXdLEN7aqioXM',
    type: 'playlist',
    title: 'Lo-Fi Beats',
    description: 'Chill beats, instrumental vibes and lo-fi melodies for focus.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f0000000254473de87526aec8577239ef',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DWUa8ZRTfalHk',
    type: 'playlist',
    title: 'Pop Rising',
    description: 'The next generation of pop music superstars.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f000000028e370a25695669b91ad8ee64',
    trackCount: 50,
  },
  {
    id: '37i9dQZF1DWZeKCadgRdKQ',
    type: 'playlist',
    title: 'Deep Focus',
    description: 'Ambient atmospheric soundscapes for deep flow states.',
    artworkUrl: 'https://i.scdn.co/image/ab67706f00000002d073e6f3e5cbd79ea7472123',
    trackCount: 50,
  },
];

export function extractSpotifyIdAndType(input: string): { id: string; type: 'playlist' | 'album' | 'track' } | null {
  const trimmed = input.trim();

  // Pattern 1: https://open.spotify.com/(playlist|album|track)/[id]...
  const urlMatch = trimmed.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/i);
  if (urlMatch) {
    return { type: urlMatch[1].toLowerCase() as any, id: urlMatch[2] };
  }

  // Pattern 2: spotify:(playlist|album|track):[id]
  const uriMatch = trimmed.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/i);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase() as any, id: uriMatch[2] };
  }

  // Pattern 3: Raw Spotify alphanumeric ID (usually 22 chars)
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return { type: 'playlist', id: trimmed };
  }

  return null;
}

export async function fetchPublicSpotifyPlaylist(urlOrId: string) {
  const parsed = extractSpotifyIdAndType(urlOrId);
  if (!parsed) {
    throw new Error('Please provide a valid Spotify playlist or album URL/URI (e.g. https://open.spotify.com/playlist/...)');
  }

  const { id, type } = parsed;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Spotify server returned status ${res.status}. Please check if the playlist is public.`);
  }

  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Unable to extract Spotify metadata. The link might be private or unavailable.');
  }

  let json: any;
  try {
    json = JSON.parse(match[1]);
  } catch (err: any) {
    throw new Error('Failed to parse Spotify playlist payload: ' + err.message);
  }

  const entity = json.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error('Spotify playlist not found or has no tracks.');
  }

  const coverUrl =
    entity.coverArt?.sources?.[0]?.url ||
    entity.visualIdentity?.image?.[0]?.url ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';

  const title = entity.title || entity.name || 'Spotify Playlist';
  const description =
    entity.subtitle ||
    entity.description ||
    `Imported from Spotify (${type === 'album' ? 'Album' : 'Playlist'})`;

  const rawTracks = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks = rawTracks.map((t: any, index: number) => {
    const rawTrackId = t.uri ? t.uri.replace('spotify:track:', '') : `track_${index}`;
    const artist =
      t.subtitle ||
      (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : '') ||
      'Unknown Artist';
    const trackTitle = t.title || t.name || 'Untitled Track';
    const durationSec = Math.round((Number(t.duration) || 0) / 1000) || 200;
    const trackArt = t.coverArt?.sources?.[0]?.url || coverUrl;

    return {
      id: `sp_${rawTrackId}`,
      spotifyId: rawTrackId,
      title: trackTitle,
      artist: artist,
      album: title,
      artworkUrl: trackArt,
      duration: durationSec,
      source: 'spotify',
      audioPreviewUrl: t.audioPreview?.url,
    };
  });

  return {
    id,
    type,
    title,
    description,
    artworkUrl: coverUrl,
    trackCount: tracks.length,
    tracks,
  };
}

export const spotifyRouter = Router();

// GET /api/spotify/playlist - Fetch and parse public Spotify playlist or album
spotifyRouter.get('/playlist', async (req: Request, res: Response) => {
  const urlOrId = (req.query.url as string) || (req.query.id as string) || '';
  if (!urlOrId) {
    return res.status(400).json({
      error: 'Please provide a "url" or "id" query parameter with a Spotify playlist or album link.',
    });
  }

  try {
    const data = await fetchPublicSpotifyPlaylist(urlOrId);
    res.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Spotify playlist fetch error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch Spotify playlist' });
  }
});

// GET /api/spotify/featured - Return popular curated Spotify playlists for 1-click import
spotifyRouter.get('/featured', (_req: Request, res: Response) => {
  res.json({ success: true, playlists: CURATED_SPOTIFY_PLAYLISTS });
});

// GET /api/spotify/auth - Initiate Spotify OAuth flow
spotifyRouter.get('/auth', (req: Request, res: Response) => {
  if (!spotifyClientId) {
    return res.status(400).send(`
      <html>
        <body style="background:#09090b;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#1DB954;">Spotify OAuth Configuration</h2>
          <p>SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are not configured on this server.</p>
          <p>You can import any Spotify playlist directly using its URL in the app without OAuth!</p>
          <button onclick="window.close()" style="background:#1DB954;border:none;color:#fff;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:bold;margin-top:20px;">Close</button>
        </body>
      </html>
    `);
  }
  const authUrl = generateSpotifyAuthUrl();
  res.redirect(authUrl);
});

// Generate authorization URL
function generateSpotifyAuthUrl(): string {
  const state = Buffer.from(
    JSON.stringify({
      csrf: Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    }),
  ).toString('base64');

  return (
    SPOTIFY_AUTHORIZE_URL +
    '?client_id=' +
    encodeURIComponent(spotifyClientId) +
    '&response_type=code&redirect_uri=' +
    encodeURIComponent(spotifyRedirectUri) +
    '&scope=' +
    encodeURIComponent(SPOTIFY_SCOPES) +
    '&state=' +
    state +
    '&show_dialog=true'
  );
}

// Exchange code for token
async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: spotifyRedirectUri,
  });

  const auth = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`, 'utf8').toString('base64');

  const tokenRes = await fetch(`${SPOTIFY_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body,
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange code for token');
  }

  return tokenRes.json();
}

// GET /api/spotify/callback - Handle Spotify OAuth callback
spotifyRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    // Post token message back to opener window if popup was used
    res.send(`
      <html>
        <body style="background:#09090b;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#1DB954;">Spotify Connected Successfully!</h2>
          <p>Closing window and returning to Celestial Music...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', token: ${JSON.stringify(tokenData.access_token)} }, '*');
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Spotify OAuth callback error:', err.message);
    res.status(500).json({ error: 'Failed to exchange authorization code', details: err.message });
  }
});

// GET /api/spotify/playlists - Fetch user's playlists with access token
spotifyRouter.get('/playlists', async (req: Request, res: Response) => {
  const accessToken = req.query.access_token as string | undefined;

  if (!accessToken) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const playlistsRes = await fetch(`${SPOTIFY_API_BASE}/me/playlists?limit=50`, { headers });

    if (!playlistsRes.ok) {
      throw new Error(`Failed to fetch playlists (status: ${playlistsRes.status})`);
    }

    const data = await playlistsRes.json();
    res.json({ success: true, playlists: data });
  } catch (err: any) {
    console.error('Spotify playlists fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Spotify playlists', details: err.message });
  }
});
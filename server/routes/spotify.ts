import { Router, Request, Response } from 'express';

// Spotify OAuth configuration
// These should be set as environment variables:
// - SPOTIFY_CLIENT_ID
// - SPOTIFY_CLIENT_SECRET
// - SPOTIFY_REDIRECT_URI (e.g. http://localhost:3000/api/spotify/callback)
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || '';
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

// Spotify authorize URL
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Scopes needed for playlist read+import
const SPOTIFY_SCOPES =
  'user-read-email user-read-playlist-read playlist-read-collaborative playlist-read-private';

// Generate the Spotify authorization URL
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
    '&show_dialog=true&response_type=code&cache=false'
  );
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: spotifyRedirectUri,
  });

  const auth = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`, 'utf8').toString(
    'base64',
  );

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

// Refresh Spotify access token
async function refreshToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const auth = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`, 'utf8').toString(
    'base64',
  );

  const tokenRes = await fetch(`${SPOTIFY_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body,
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to refresh Spotify token');
  }

  return tokenRes.json();
}

// Get current user's playlists
async function getUserPlaylists(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const playlistsRes = await fetch(`${SPOTIFY_API_BASE}/me/playlists?limit=50`, {
    headers,
  });

  if (!playlistsRes.ok) {
    throw new Error('Failed to fetch Spotify playlists');
  }

  return playlistsRes.json();
}

export const spotifyRouter = Router();

// GET /api/spotify/auth - Initiate Spotify OAuth flow
spotifyRouter.get('/auth', (req: Request, res: Response) => {
  const authUrl = generateSpotifyAuthUrl();
  res.json({ authUrl });
});

// GET /api/spotify/callback - Handle Spotify OAuth callback
spotifyRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    // TODO: Store token securely (e.g., in IndexedDB, Firebase, or server session)
    // For now, return the tokens so the frontend can store them
    res.json({
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      // In production, you'd store the refresh_token securely and associate it with the user
    });
  } catch (err: any) {
    console.error('Spotify OAuth callback error:', err.message);
    res.status(500).json({ error: 'Failed to exchange authorization code', details: err.message });
  }
});

// GET /api/spotify/playlists - Fetch user's playlists from Spotify
spotifyRouter.get('/playlists', async (req: Request, res: Response) => {
  const accessToken = req.query.access_token as string | undefined;

  if (!accessToken) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const playlists = await getUserPlaylists(accessToken);
    res.json({ success: true, playlists });
  } catch (err: any) {
    console.error('Spotify playlists fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Spotify playlists', details: err.message });
  }
});
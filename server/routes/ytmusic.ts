/**
 * YouTube Music API Router
 * 
 * Provides a dedicated, standardized REST API for YouTube Music data.
 * Powered by Innertube (youtubei.js) and optional YouTube Data API v3 integration.
 */

import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';
import { handleAudioStreamProxy } from './songs';

export const ytmusicRouter = Router();

// API Index & Documentation
ytmusicRouter.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Celestial Pure YouTube API',
    version: '1.0.0',
    description: 'High-speed pure YouTube REST API with full metadata, search, charts, and streaming.',
    status: 'operational',
    provider: 'Pure YouTube API (Innertube Engine)',
    endpoints: {
      documentation: 'GET /api/ytmusic',
      search: 'GET /api/ytmusic/search?q={query}&type={songs|albums|artists|playlists|all}',
      home: 'GET /api/ytmusic/home',
      trending: 'GET /api/ytmusic/trending',
      song: 'GET /api/ytmusic/song/:id',
      album: 'GET /api/ytmusic/album/:id',
      artist: 'GET /api/ytmusic/artist/:id',
      playlist: 'GET /api/ytmusic/playlist/:id',
      lyrics: 'GET /api/ytmusic/lyrics/:id?title=...&artist=...',
      queue: 'GET /api/ytmusic/queue/:id',
      stream: 'GET /api/ytmusic/stream/:id',
      audio: 'GET /api/ytmusic/audio/:id',
    },
  });
});

// GET /api/ytmusic/search?q=...&type=...
ytmusicRouter.get('/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.query || '').trim();
  const filter = String(req.query.type || req.query.filter || 'all').toLowerCase();

  if (!query) {
    return res.json({
      query: '',
      filter,
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
    });
  }

  try {
    const results = await youtubeMusicService.search(query, filter);
    res.json({
      query,
      filter,
      ...results,
    });
  } catch (err: any) {
    console.error('[YTMusic API] Search error:', err?.message || err);
    res.status(500).json({ error: 'Search failed', details: err?.message });
  }
});

// GET /api/ytmusic/home
ytmusicRouter.get('/home', async (req: Request, res: Response) => {
  try {
    const homeData = await youtubeMusicService.getHome();
    res.json(homeData);
  } catch (err: any) {
    console.error('[YTMusic API] Home feed error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load home feed', details: err?.message });
  }
});

// GET /api/ytmusic/trending
ytmusicRouter.get('/trending', async (req: Request, res: Response) => {
  try {
    const searchData = await youtubeMusicService.search('trending hits global top', 'songs');
    res.json({
      trending: searchData.songs || [],
    });
  } catch (err: any) {
    console.error('[YTMusic API] Trending error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load trending music', details: err?.message });
  }
});

// GET /api/ytmusic/song/:id
ytmusicRouter.get('/song/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const song = await youtubeMusicService.getSong(id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    res.json(song);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch song details', details: err?.message });
  }
});

// GET /api/ytmusic/album/:id
ytmusicRouter.get('/album/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const album = await youtubeMusicService.getAlbum(id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    res.json(album);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch album', details: err?.message });
  }
});

// GET /api/ytmusic/artist/:id
ytmusicRouter.get('/artist/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const artist = await youtubeMusicService.getArtist(id);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    res.json(artist);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch artist', details: err?.message });
  }
});

// GET /api/ytmusic/playlist/:id
ytmusicRouter.get('/playlist/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const playlist = await youtubeMusicService.getPlaylist(id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch playlist', details: err?.message });
  }
});

// GET /api/ytmusic/lyrics/:id
ytmusicRouter.get('/lyrics/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const title = String(req.query.title || '');
  const artist = String(req.query.artist || '');
  const duration = parseInt(String(req.query.duration || '0'), 10) || undefined;

  try {
    const lyrics = await youtubeMusicService.getLyrics(id, { title, artist, duration });
    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }
    res.json(lyrics);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch lyrics', details: err?.message });
  }
});

// GET /api/ytmusic/queue/:id
ytmusicRouter.get('/queue/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const queue = await youtubeMusicService.getQueue(id);
    res.json({
      songId: id,
      queue: queue || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch radio queue', details: err?.message });
  }
});

// GET /api/ytmusic/stream/:id
ytmusicRouter.get('/stream/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const stream = await youtubeMusicService.getStream(id);
    res.json({
      songId: id,
      ...stream,
    });
  } catch (err: any) {
    res.status(503).json({ error: 'Playback stream unavailable', details: err?.message });
  }
});

// GET /api/ytmusic/audio/:id
ytmusicRouter.get('/audio/:id', handleAudioStreamProxy);

/* ----------------- REAL YOUTUBE MUSIC ACCOUNT INTEGRATION ----------------- */

interface DeviceSession {
  client_id: { client_id: string; client_secret: string };
  status: 'pending' | 'authenticated' | 'expired' | 'denied';
  user?: any;
  tokens?: any;
  createdAt: number;
}

const deviceSessions = new Map<string, DeviceSession>();

// Purge expired sessions older than 30 mins
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of deviceSessions.entries()) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      deviceSessions.delete(code);
    }
  }
}, 5 * 60 * 1000);

// POST /api/ytmusic/auth/device-code
// Initiates official Google Device authorization for real YouTube Music accounts
ytmusicRouter.post('/auth/device-code', async (req: Request, res: Response) => {
  try {
    const yt = await youtubeMusicService.getInnertube();
    if (!yt) {
      return res.status(503).json({ error: 'YouTube engine currently unavailable' });
    }

    let clientId = yt.session.oauth.client_id;
    if (!clientId) {
      clientId = await yt.session.oauth.getClientID();
      yt.session.oauth.client_id = clientId;
    }

    const codeData = await yt.session.oauth.getDeviceAndUserCode();

    deviceSessions.set(codeData.device_code, {
      client_id: clientId,
      status: 'pending',
      createdAt: Date.now(),
    });

    res.json({
      user_code: codeData.user_code,
      verification_url: codeData.verification_url,
      device_code: codeData.device_code,
      expires_in: codeData.expires_in,
      interval: codeData.interval || 5,
    });
  } catch (err: any) {
    console.error('[Device Code Error]:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to start Google sign-in' });
  }
});

// GET /api/ytmusic/auth/device-poll?code=...
// Polls Google for authorization completion
ytmusicRouter.get('/auth/device-poll', async (req: Request, res: Response) => {
  const deviceCode = String(req.query.code || req.query.device_code || '').trim();
  if (!deviceCode) {
    return res.status(400).json({ error: 'Missing device code' });
  }

  const session = deviceSessions.get(deviceCode);
  if (!session) {
    return res.status(404).json({ status: 'expired', error: 'Session expired or not found' });
  }

  if (session.status === 'authenticated' && session.user) {
    return res.json({ status: 'authenticated', user: session.user, tokens: session.tokens });
  }

  try {
    const payload = {
      client_id: session.client_id.client_id,
      client_secret: session.client_id.client_secret,
      code: deviceCode,
      grant_type: 'http://oauth.net/grant_type/device/1.0',
    };

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const tokenData: any = await tokenRes.json();

    if (tokenData.error) {
      if (tokenData.error === 'authorization_pending') {
        return res.json({ status: 'pending' });
      }
      if (tokenData.error === 'slow_down') {
        return res.json({ status: 'slow_down' });
      }
      if (tokenData.error === 'expired_token') {
        session.status = 'expired';
        return res.json({ status: 'expired' });
      }
      if (tokenData.error === 'access_denied') {
        session.status = 'denied';
        return res.json({ status: 'denied' });
      }
      return res.json({ status: 'error', error: tokenData.error_description || tokenData.error });
    }

    if (tokenData.access_token) {
      // Authorized! Extract real account profile
      let userProfile: any = null;
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userRes.ok) {
          userProfile = await userRes.json();
        }
      } catch (e) {
        // userinfo optional
      }

      const uid = `yt_${userProfile?.sub || Date.now().toString(36)}`;
      const user = {
        uid,
        displayName: userProfile?.name || 'YouTube Music User',
        email: userProfile?.email || null,
        photoURL: userProfile?.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
        handle: userProfile?.email ? `@${userProfile.email.split('@')[0]}` : '@ytmusic_user',
      };

      session.status = 'authenticated';
      session.tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      };
      session.user = user;

      return res.json({
        status: 'authenticated',
        tokens: session.tokens,
        user,
      });
    }

    return res.json({ status: 'pending' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Poll failed' });
  }
});

// POST /api/ytmusic/auth/connect-channel
// Resolves a real YouTube channel handle or URL into authenticated metadata
ytmusicRouter.post('/auth/connect-channel', async (req: Request, res: Response) => {
  const query = String(req.body.query || req.body.handle || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Please enter a YouTube handle (@username) or channel link' });
  }

  try {
    const yt = await youtubeMusicService.getInnertube();
    if (!yt) return res.status(503).json({ error: 'YouTube engine unavailable' });

    let clean = query;
    if (!clean.startsWith('http')) {
      if (clean.startsWith('@')) clean = `https://www.youtube.com/${clean}`;
      else if (clean.startsWith('UC')) clean = `https://www.youtube.com/channel/${clean}`;
      else clean = `https://www.youtube.com/@${clean}`;
    }

    const resolved = await yt.resolveURL(clean).catch(() => null);
    const browseId = resolved?.payload?.browseId || resolved?.payload?.channelId || (query.startsWith('UC') ? query : null);
    if (!browseId) {
      return res.status(404).json({ error: 'Could not find YouTube channel. Please check the handle or link.' });
    }

    const channel = await yt.getChannel(browseId);
    const title = channel?.metadata?.title || query;
    const avatar = channel?.metadata?.avatar?.[0]?.url || null;
    const channelId = browseId;

    const user = {
      uid: `yt_ch_${channelId}`,
      displayName: title,
      photoURL: avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
      handle: query.startsWith('@') ? query : `@${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      channelId,
    };

    res.json({
      success: true,
      user,
    });
  } catch (err: any) {
    console.error('[Connect Channel Error]:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to connect YouTube channel' });
  }
});

// POST /api/ytmusic/auth/connect-cookie
// Connects with YouTube Music session cookie
ytmusicRouter.post('/auth/connect-cookie', async (req: Request, res: Response) => {
  const cookie = String(req.body.cookie || '').trim();
  if (!cookie) {
    return res.status(400).json({ error: 'Please provide a valid YouTube Music cookie string' });
  }

  try {
    const { Innertube } = await import('youtubei.js');
    const userYt = await Innertube.create({ cookie });

    let accountInfo: any = null;
    try {
      accountInfo = await userYt.account.getInfo();
    } catch {}

    const name = accountInfo?.contents?.[0]?.account_name?.text || 'YouTube Music Account';
    const avatar = accountInfo?.contents?.[0]?.account_photo?.[0]?.url || null;
    const email = accountInfo?.contents?.[0]?.email?.text || null;

    let likedSongs: any[] = [];
    try {
      const lm = await userYt.getPlaylist('LM');
      if (lm && Array.isArray(lm.videos)) {
        likedSongs = lm.videos.slice(0, 50).map((v: any) => ({
          id: v.id,
          title: v.title?.text || 'Liked Song',
          artist: v.author?.name || 'Artist',
          album: 'YouTube Liked Songs',
          artworkUrl: v.thumbnails?.[0]?.url || avatar,
          duration: v.duration?.seconds || 210,
          streamUrl: `/api/song/${v.id}/audio`,
        }));
      }
    } catch {}

    const user = {
      uid: `yt_cookie_${Date.now().toString(36)}`,
      displayName: name,
      photoURL: avatar,
      email,
      handle: email ? `@${email.split('@')[0]}` : '@ytmusic_user',
    };

    res.json({
      success: true,
      user,
      likedSongs,
    });
  } catch (err: any) {
    console.error('[Connect Cookie Error]:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Invalid or expired YouTube Music cookie' });
  }
});

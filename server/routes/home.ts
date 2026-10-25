import { Router, Request, Response } from 'express';
import { youtubeMusicService } from '../services/youtubeMusic';

export const homeRouter = Router();

// GET /api/home
homeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const mood = typeof req.query.mood === 'string' ? req.query.mood : undefined;
    // Taste seeds (top artists from the listener's own history) arrive as one CSV field.
    const seeds =
      typeof req.query.seeds === 'string'
        ? req.query.seeds.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const sections = await youtubeMusicService.getHome(forceRefresh, mood, seeds);
    res.json({ sections });
  } catch (err: any) {
    console.warn('Home route notice, returning empty feed:', err?.message || err);
    res.json({ sections: [] });
  }
});

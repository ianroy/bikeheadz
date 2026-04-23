import { db, hasDb } from '../db.js';

const FALLBACK = [
  { id: 'e1', title: 'SF Bike Fest 2026', date: 'May 10', location: 'San Francisco, CA', img: 'https://images.unsplash.com/photo-1774266854673-3f03daa491d6?w=400&q=80' },
  { id: 'e2', title: 'Urban Cycle Expo',  date: 'Jun 4',  location: 'Portland, OR',      img: 'https://images.unsplash.com/photo-1774165098214-4abca7edc1cb?w=400&q=80' },
];

export const eventsCommands = {
  'events.list': async () => {
    if (!hasDb()) return FALLBACK;
    const { rows } = await db.query(
      `SELECT id,
              title,
              to_char(happens_at, 'Mon DD') AS date,
              location,
              image_url AS img
         FROM events
        WHERE happens_at >= NOW() - INTERVAL '1 day'
        ORDER BY happens_at
        LIMIT 20`
    );
    return rows.length ? rows : FALLBACK;
  },
};

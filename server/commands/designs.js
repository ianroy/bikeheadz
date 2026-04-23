import { db, hasDb } from '../db.js';

const FALLBACK = [
  { id: '1', name: "Alex's Head", date: 'Apr 18, 2026', thumbnail: 'https://images.unsplash.com/photo-1684770114368-6e01b4f8741a?w=200&q=80', material: 'chrome', stars: 5 },
  { id: '2', name: 'Jordan Stem', date: 'Apr 12, 2026', thumbnail: 'https://images.unsplash.com/photo-1667761673934-70b67e527f1f?w=200&q=80', material: 'gloss',  stars: 4 },
  { id: '3', name: 'Sam Rider',   date: 'Mar 29, 2026', thumbnail: 'https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=200&q=80', material: 'matte',  stars: 5 },
];

export const designsCommands = {
  'designs.list': async () => {
    if (!hasDb()) return FALLBACK;
    const { rows } = await db.query(
      `SELECT id::text,
              name,
              to_char(created_at, 'Mon DD, YYYY') AS date,
              thumbnail_url AS thumbnail,
              material,
              stars
         FROM designs
        ORDER BY created_at DESC
        LIMIT 50`
    );
    return rows.length ? rows : FALLBACK;
  },

  'designs.save': async ({ payload }) => {
    const { name, thumbnail = null, material = 'chrome', stars = 5, settings = {} } = payload || {};
    if (!name) throw new Error('name_required');
    if (!hasDb()) return { id: String(Date.now()), name, material, stars, thumbnail };
    const { rows } = await db.query(
      `INSERT INTO designs (name, thumbnail_url, material, stars, settings)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id::text, name,
                 to_char(created_at, 'Mon DD, YYYY') AS date,
                 thumbnail_url AS thumbnail, material, stars`,
      [name, thumbnail, material, stars, settings]
    );
    return rows[0];
  },

  'designs.delete': async ({ payload }) => {
    const { id } = payload || {};
    if (!id) throw new Error('id_required');
    if (!hasDb()) return { ok: true };
    await db.query('DELETE FROM designs WHERE id = $1', [id]);
    return { ok: true };
  },
};

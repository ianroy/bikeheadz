import { db, hasDb } from '../db.js';

const DEFAULT_PROFILE = {
  displayName: 'Alex Rider',
  email: 'alex@bikeheadz.com',
  preferences: {
    shipNotify: true,
    marketing: false,
    defaultChrome: true,
  },
};

export const accountCommands = {
  'account.get': async () => {
    if (!hasDb()) return DEFAULT_PROFILE;
    const { rows } = await db.query(
      `SELECT display_name AS "displayName",
              email,
              preferences
         FROM accounts
        WHERE id = 1`
    );
    return rows[0] || DEFAULT_PROFILE;
  },

  'account.update': async ({ payload }) => {
    const {
      displayName = DEFAULT_PROFILE.displayName,
      email = DEFAULT_PROFILE.email,
      preferences = DEFAULT_PROFILE.preferences,
    } = payload || {};
    if (!hasDb()) return { ok: true, displayName, email, preferences };
    await db.query(
      `INSERT INTO accounts (id, display_name, email, preferences)
       VALUES (1,$1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email        = EXCLUDED.email,
         preferences  = EXCLUDED.preferences,
         updated_at   = NOW()`,
      [displayName, email, preferences]
    );
    return { ok: true, displayName, email, preferences };
  },
};

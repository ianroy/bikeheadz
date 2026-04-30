// P1-005 — orders list scoped to the authenticated user.
//
// Previously this command returned a 3-row demo dataset (Alex's Chrome
// Head / Jordan 4-Pack / Sam Matte Print) for anonymous visitors so
// the /account page had something to render in dev. That stub leaked
// to production, making the page look like a fake identity was
// already signed in. Anonymous callers now get an empty array; the
// SPA renders the proper "Sign in" empty state instead.

import { db, hasDb } from '../db.js';
import { maybeUser } from '../auth.js';

export const ordersCommands = {
  'orders.list': async ({ socket }) => {
    const user = maybeUser({ socket });
    if (!user) return [];
    if (!hasDb()) return [];
    const { rows } = await db.query(
      `SELECT p.id::text,
              COALESCE(gd.photo_name, p.product) AS name,
              to_char(p.paid_at, 'Mon DD, YYYY') AS date,
              CASE p.status
                WHEN 'paid'      THEN 'Paid'
                WHEN 'in_queue'  THEN 'In Queue'
                WHEN 'printing'  THEN 'Printing'
                WHEN 'shipped'   THEN 'Shipped'
                WHEN 'delivered' THEN 'Delivered'
                WHEN 'refunded'  THEN 'Refunded'
                ELSE INITCAP(p.status)
              END AS status,
              concat('$', to_char(p.amount_cents/100.0, 'FM999990.00')) AS price,
              1 AS qty,
              p.product,
              p.shipping_tracking,
              p.design_id::text AS design_id
         FROM purchases p
         LEFT JOIN generated_designs gd ON gd.id = p.design_id
        WHERE p.account_id = $1
        ORDER BY p.id DESC
        LIMIT 100`,
      [user.id]
    );
    return rows;
  },
};

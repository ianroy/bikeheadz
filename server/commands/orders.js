// P1-005 — orders list scoped to user, plus the legacy demo dataset for
// anonymous visitors (so the home page still has something to render in
// dev when DATABASE_URL is unset).

import { db, hasDb } from '../db.js';
import { maybeUser } from '../auth.js';

const FALLBACK = [
  { id: 'ORD-2841', name: "Alex's Chrome Head", date: 'Apr 18, 2026', status: 'Shipped',   price: '$19.99', qty: 1 },
  { id: 'ORD-2759', name: 'Jordan 4-Pack',      date: 'Apr 5, 2026',  status: 'Delivered', price: '$59.99', qty: 4 },
  { id: 'ORD-2601', name: 'Sam Matte Print',    date: 'Mar 18, 2026', status: 'Delivered', price: '$19.99', qty: 1 },
];

export const ordersCommands = {
  'orders.list': async ({ socket }) => {
    const user = maybeUser({ socket });
    if (!hasDb()) return FALLBACK;
    if (user) {
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
    }
    // Anonymous: legacy demo orders table (kept for back-compat).
    const { rows } = await db.query(
      `SELECT id, name,
              to_char(placed_at, 'Mon DD, YYYY') AS date,
              status, price, qty
         FROM orders
        ORDER BY placed_at DESC
        LIMIT 100`
    );
    return rows.length ? rows : FALLBACK;
  },
};

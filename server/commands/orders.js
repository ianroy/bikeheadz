import { db, hasDb } from '../db.js';

const FALLBACK = [
  { id: 'ORD-2841', name: "Alex's Chrome Head", date: 'Apr 18, 2026', status: 'Shipped',   price: '$19.99', qty: 1 },
  { id: 'ORD-2759', name: 'Jordan 4-Pack',      date: 'Apr 5, 2026',  status: 'Delivered', price: '$59.99', qty: 4 },
  { id: 'ORD-2601', name: 'Sam Matte Print',    date: 'Mar 18, 2026', status: 'Delivered', price: '$19.99', qty: 1 },
];

export const ordersCommands = {
  'orders.list': async () => {
    if (!hasDb()) return FALLBACK;
    const { rows } = await db.query(
      `SELECT id,
              name,
              to_char(placed_at, 'Mon DD, YYYY') AS date,
              status,
              price,
              qty
         FROM orders
        ORDER BY placed_at DESC
        LIMIT 100`
    );
    return rows.length ? rows : FALLBACK;
  },
};

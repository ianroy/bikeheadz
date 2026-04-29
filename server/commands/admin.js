// P0-008 / P4-005 / P4-006 / P4-008 / P4-010 / P4-014 / P4-015 — admin surface.
//
// Every command is gated by `requireAdmin`. State-changing actions write
// an audit row (P0-009).

import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { recordAudit } from '../audit.js';
import { db, hasDb } from '../db.js';
import { CommandError, ErrorCode } from '../errors.js';
import { logger } from '../logger.js';

const RangeSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
});

const UserListSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'admin', 'support']).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

const PromoteSchema = z.object({
  userId: z.union([z.number().int(), z.string().regex(/^\d+$/)]).transform((v) => Number(v)),
  role: z.enum(['user', 'admin', 'support']),
});

const ForceLogoutSchema = z.object({
  userId: z.union([z.number().int(), z.string()]).transform((v) => Number(v)),
});

const ImpersonateSchema = z.object({
  userId: z.union([z.number().int(), z.string()]).transform((v) => Number(v)),
});

function rangeToInterval(range) {
  return range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days';
}

export const adminCommands = {
  // P4-005 — top-line overview.
  'admin.metrics.summary': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    if (!hasDb()) {
      return {
        range,
        generations: 0,
        purchases: 0,
        revenue_cents: 0,
        unique_users: 0,
        cache_hit_rate: 0,
      };
    }
    const interval = rangeToInterval(range);
    const [g, p, r] = await Promise.all([
      db.query(
        `SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}') AS generations,
                COUNT(DISTINCT account_id) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}')
                  AS unique_users
           FROM generated_designs`
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '${interval}') AS purchases,
                COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '${interval}'), 0) AS revenue
           FROM purchases`
      ),
      db.query(
        `SELECT COALESCE(SUM(cache_hits),0) AS hits, COALESCE(SUM(cache_misses),0) AS misses
           FROM daily_stats WHERE day > CURRENT_DATE - INTERVAL '${interval}'`
      ),
    ]);
    const hits = Number(r.rows[0].hits || 0);
    const misses = Number(r.rows[0].misses || 0);
    return {
      range,
      generations: Number(g.rows[0].generations),
      unique_users: Number(g.rows[0].unique_users),
      purchases: Number(p.rows[0].purchases),
      revenue_cents: Number(p.rows[0].revenue),
      cache_hit_rate: hits + misses === 0 ? 0 : hits / (hits + misses),
    };
  },

  'admin.metrics.timeseries': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    if (!hasDb()) return { range, points: [] };
    const interval = rangeToInterval(range);
    const { rows } = await db.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, generations, purchases_paid, revenue_cents
         FROM daily_stats
        WHERE day > CURRENT_DATE - INTERVAL '${interval}'
        ORDER BY day ASC`
    );
    return { range, points: rows };
  },

  // P4-006 — user management list.
  'admin.users.list': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { search, role, page, pageSize } = UserListSchema.parse(payload || {});
    if (!hasDb()) return { rows: [], total: 0, page, pageSize };
    const offset = (page - 1) * pageSize;
    const params = [];
    const where = ['deleted_at IS NULL'];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`LOWER(email) LIKE $${params.length}`);
    }
    if (role) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }
    params.push(pageSize, offset);
    const { rows } = await db.query(
      `SELECT id, email, display_name, role, last_login_at, created_at,
              (SELECT COUNT(*) FROM generated_designs gd WHERE gd.account_id = a.id) AS designs,
              (SELECT COALESCE(SUM(amount_cents),0) FROM purchases p WHERE p.account_id = a.id AND status = 'paid') AS spend_cents
         FROM accounts a
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { rows, page, pageSize };
  },

  'admin.users.promote': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = PromoteSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const { userId, role } = parsed.data;
    if (!hasDb()) return { ok: true };
    await db.query(`UPDATE accounts SET role = $1 WHERE id = $2`, [role, userId]);
    await recordAudit({
      actorId: actor.id,
      action: 'admin.user.role_change',
      targetType: 'user',
      targetId: userId,
      metadata: { role },
    });
    return { ok: true };
  },

  'admin.users.forceLogout': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = ForceLogoutSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    await db.query(`UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [
      parsed.data.userId,
    ]);
    await db.query(`UPDATE accounts SET session_token_version = session_token_version + 1 WHERE id = $1`, [
      parsed.data.userId,
    ]);
    await recordAudit({
      actorId: actor.id,
      action: 'admin.user.force_logout',
      targetType: 'user',
      targetId: parsed.data.userId,
    });
    return { ok: true };
  },

  // P4-010 — last 100 audit_log + currently-active sessions count.
  'admin.live.now': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { sessions: 0, recent: [], failures: [] };
    const [s, a] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL AND last_seen_at > NOW() - INTERVAL '15 minutes'`),
      db.query(
        `SELECT id, action, target_type, target_id, created_at
           FROM audit_log ORDER BY created_at DESC LIMIT 100`
      ),
    ]);
    return {
      sessions: Number(s.rows[0].n),
      recent: a.rows,
      failures: [],
    };
  },

  // P4-014 — slow query view (assumes pg_stat_statements).
  'admin.db.slowQueries': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    try {
      const { rows } = await db.query(
        `SELECT query, calls, total_exec_time, mean_exec_time
           FROM pg_stat_statements
          WHERE query NOT LIKE '%pg_stat_statements%'
          ORDER BY mean_exec_time DESC
          LIMIT 20`
      );
      return { rows };
    } catch (err) {
      logger.warn({ msg: 'admin.slow_query.unavailable', err: err.message });
      return { rows: [], error: 'pg_stat_statements_not_enabled' };
    }
  },

  // P4-015 — start an impersonation session for a target user.
  'admin.impersonate.begin': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = ImpersonateSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true, target: parsed.data.userId };
    const { rows } = await db.query(`SELECT id, email, role FROM accounts WHERE id = $1`, [
      parsed.data.userId,
    ]);
    const target = rows[0];
    if (!target) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'user_not_found');
    if (target.role === 'admin') {
      throw new CommandError(ErrorCode.FORBIDDEN_ADMIN_ONLY, 'cannot_impersonate_admin');
    }
    await recordAudit({
      actorId: actor.id,
      onBehalfOf: target.id,
      action: 'admin.impersonate.begin',
      targetType: 'user',
      targetId: target.id,
    });
    return { ok: true, target: { id: target.id, email: target.email } };
  },
};

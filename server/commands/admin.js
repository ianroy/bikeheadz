// P0-008 / P4-005 / P4-006 / P4-008 / P4-010 / P4-014 / P4-015 — admin surface.
//
// Every command is gated by `requireAdmin`. State-changing actions write
// an audit row (P0-009).

import { z } from 'zod';
import {
  requireAdmin,
  createMagicToken,
  createInvite as createInviteHelper,
} from '../auth.js';
import { recordAudit } from '../audit.js';
import { db, hasDb } from '../db.js';
import { CommandError, ErrorCode } from '../errors.js';
import { logger } from '../logger.js';
import { sendEmail } from '../email.js';
import { getRunpodTelemetry, pingRunpod } from '../workers/runpod-client.js';

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

  // ── User management (migration 006) ──────────────────────────────

  // Promote / demote a user. role ∈ {user, admin, support}.
  'admin.users.setRole': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = PromoteSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    const { rows } = await db.query(
      `UPDATE accounts SET role = $2, session_token_version = session_token_version + 1
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, email, role`,
      [parsed.data.userId, parsed.data.role]
    );
    if (!rows.length) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'user_not_found');
    await recordAudit({
      actorId: actor.id, action: 'admin.role_changed',
      targetType: 'user', targetId: String(parsed.data.userId),
      metadata: { role: parsed.data.role },
    });
    return { ok: true, user: rows[0] };
  },

  // Admin-triggered password reset email.
  'admin.users.sendPasswordReset': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const Schema = z.object({
      userId: z.union([z.number().int(), z.string()]).transform((v) => Number(v)),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid');
    if (!hasDb()) return { ok: true, sent: false };
    const { rows } = await db.query(
      `SELECT email FROM accounts WHERE id = $1 AND deleted_at IS NULL`,
      [parsed.data.userId]
    );
    if (!rows.length) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'user_not_found');
    const email = rows[0].email;
    const { token, expiresAt } = await createMagicToken({
      email, channel: 'password_reset', ip: null, userAgent: null,
    });
    const base = (process.env.APP_URL || 'https://stemdomez.com').replace(/\/$/, '');
    const resetUrl =
      `${base}/auth/consume?token=${encodeURIComponent(token)}` +
      `&redirect=${encodeURIComponent('/account?reset=1')}`;
    const result = await sendEmail({ to: email, template: 'password-reset', data: { resetUrl } });
    await recordAudit({
      actorId: actor.id, action: 'admin.password_reset_sent',
      targetType: 'user', targetId: String(parsed.data.userId),
      metadata: { sent: result.ok, backend: result.backend || 'console' },
    });
    return { ok: true, sent: result.ok, expiresAt: expiresAt.toISOString() };
  },

  // Admin sends an invite. Creates a row in `invites` + emails the
  // recipient with a single-use accept link.
  'admin.invites.send': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const Schema = z.object({
      email: z.string().trim().toLowerCase().email(),
      message: z.string().max(500).optional(),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const invite = await createInviteHelper({
      email: parsed.data.email,
      sentBy: actor.id,
      message: parsed.data.message || null,
    });
    const base = (process.env.APP_URL || 'https://stemdomez.com').replace(/\/$/, '');
    const acceptUrl = `${base}/login?invite=${encodeURIComponent(invite.code)}`;
    const result = await sendEmail({
      to: parsed.data.email,
      template: 'invite',
      data: {
        acceptUrl,
        message: parsed.data.message || '',
        inviterEmail: actor.email,
      },
    });
    await recordAudit({
      actorId: actor.id, action: 'admin.invite_sent',
      targetType: 'email', targetId: parsed.data.email,
      metadata: { sent: result.ok, backend: result.backend || 'console' },
    });
    return { ok: true, invite, sent: result.ok };
  },

  'admin.invites.list': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    const { rows } = await db.query(
      `SELECT i.id, i.email, i.sent_at, i.expires_at, i.accepted_at, i.message,
              a.email AS sent_by_email
         FROM invites i
         LEFT JOIN accounts a ON a.id = i.sent_by
        ORDER BY i.sent_at DESC LIMIT 200`
    );
    return { rows };
  },

  // ── Metrics for the dashboard tabs (migration 006) ──────────────

  // Trends graph — daily counts for the line chart. Each metric is
  // an array of {date, count} for the requested range. Chart.js
  // overlays them as separate datasets in the brand palette.
  'admin.metrics.timeseries': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    if (!hasDb()) {
      return { range, days, series: { hits: [], signups: [], photos: [], jobs_started: [], jobs_succeeded: [], stl_downloads: [] } };
    }
    // Generate dense day series so Chart.js doesn't have gaps.
    const series = {};
    const queries = [
      ['hits',           `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '${days} days' GROUP BY day ORDER BY day`],
      ['signups',        `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n FROM accounts WHERE created_at > NOW() - INTERVAL '${days} days' GROUP BY day ORDER BY day`],
      ['photos',         `SELECT date_trunc('day', uploaded_at) AS day, COUNT(*)::int AS n FROM user_photos WHERE uploaded_at > NOW() - INTERVAL '${days} days' GROUP BY day ORDER BY day`],
      ['jobs_started',   `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${days} days' GROUP BY day ORDER BY day`],
      ['jobs_succeeded', `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${days} days' AND triangles IS NOT NULL GROUP BY day ORDER BY day`],
      ['stl_downloads',  `SELECT date_trunc('day', paid_at) AS day, COUNT(*)::int AS n FROM purchases WHERE paid_at > NOW() - INTERVAL '${days} days' AND status = 'paid' GROUP BY day ORDER BY day`],
    ];
    for (const [name, sql] of queries) {
      try { const { rows } = await db.query(sql); series[name] = rows.map((r) => ({ date: r.day, count: Number(r.n) })); }
      catch (err) { logger.debug({ msg: 'admin.timeseries.query_failed', name, err: err.message }); series[name] = []; }
    }
    return { range, days, series };
  },

  // Funnel — Land → Sign in → Generate → Purchase / Free download.
  'admin.metrics.funnel': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, steps: [] };
    const [{ rows: visitors }, { rows: signups }, { rows: generators }, { rows: downloaders }] = await Promise.all([
      db.query(`SELECT COUNT(DISTINCT session_key)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '${interval}'`),
      db.query(`SELECT COUNT(*)::int AS n FROM accounts WHERE created_at > NOW() - INTERVAL '${interval}'`),
      db.query(`SELECT COUNT(DISTINCT account_id)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${interval}' AND account_id IS NOT NULL`),
      db.query(`SELECT COUNT(DISTINCT account_id)::int AS n FROM purchases WHERE paid_at > NOW() - INTERVAL '${interval}' AND status = 'paid' AND account_id IS NOT NULL`),
    ]);
    const steps = [
      { label: 'Visitors',    n: visitors[0]?.n || 0 },
      { label: 'Signed up',   n: signups[0]?.n || 0 },
      { label: 'Generated',   n: generators[0]?.n || 0 },
      { label: 'Downloaded',  n: downloaders[0]?.n || 0 },
    ];
    return { range, steps };
  },

  // Login locations for the world map.
  'admin.metrics.geo': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, rows: [] };
    const { rows } = await db.query(
      `SELECT geo_country AS country, geo_city AS city, COUNT(*)::int AS n,
              MAX(created_at) AS last_seen
         FROM page_views
        WHERE created_at > NOW() - INTERVAL '${interval}'
          AND geo_country IS NOT NULL
        GROUP BY geo_country, geo_city
        ORDER BY n DESC LIMIT 500`
    );
    return { range, rows };
  },

  // Device + browser split.
  'admin.metrics.devices': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, devices: [], oses: [], browsers: [] };
    const [{ rows: devices }, { rows: oses }, { rows: browsers }] = await Promise.all([
      db.query(`SELECT COALESCE(device_kind,'unknown') AS k, COUNT(*)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY k ORDER BY n DESC`),
      db.query(`SELECT COALESCE(os_kind,'unknown') AS k, COUNT(*)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY k ORDER BY n DESC`),
      db.query(`SELECT COALESCE(browser_kind,'unknown') AS k, COUNT(*)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY k ORDER BY n DESC`),
    ]);
    return { range, devices, oses, browsers };
  },

  // Referrer source split — strips down to the host so noise from
  // long URLs doesn't blow up the table.
  'admin.metrics.referrers': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, rows: [] };
    const { rows } = await db.query(
      `SELECT
          COALESCE(NULLIF(regexp_replace(referrer, '^https?://([^/]+).*$', '\\1'), ''), '(direct)') AS host,
          COUNT(*)::int AS n,
          COUNT(DISTINCT session_key)::int AS unique_visitors
        FROM page_views
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY host
        ORDER BY n DESC LIMIT 100`
    );
    return { range, rows };
  },

  // Cohort retention — Day 0/1/7/30 returning rate by signup week.
  'admin.metrics.cohorts': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    const { rows } = await db.query(
      `WITH cohorts AS (
         SELECT id AS account_id, date_trunc('week', created_at) AS cohort
           FROM accounts WHERE deleted_at IS NULL
       ),
       activity AS (
         SELECT pv.account_id, c.cohort,
                EXTRACT(EPOCH FROM (pv.created_at - c.cohort)) / 86400 AS day
           FROM page_views pv JOIN cohorts c ON c.account_id = pv.account_id
       )
       SELECT cohort,
              COUNT(DISTINCT account_id) FILTER (WHERE day BETWEEN 0 AND 1) AS d0,
              COUNT(DISTINCT account_id) FILTER (WHERE day BETWEEN 1 AND 2) AS d1,
              COUNT(DISTINCT account_id) FILTER (WHERE day BETWEEN 7 AND 8) AS d7,
              COUNT(DISTINCT account_id) FILTER (WHERE day BETWEEN 30 AND 31) AS d30,
              (SELECT COUNT(*) FROM cohorts c2 WHERE c2.cohort = activity.cohort) AS size
         FROM activity GROUP BY cohort ORDER BY cohort DESC LIMIT 26`
    );
    return { rows };
  },

  // TRELLIS pipeline health histogram.
  'admin.metrics.pipeline': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, total: 0, watertight_pct: 0, retried_pct: 0, tri_buckets: [] };
    const [tot, water, retr, hist] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${interval}'`),
      db.query(`SELECT COUNT(*)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${interval}' AND watertight = TRUE`),
      db.query(`SELECT COUNT(*)::int AS n FROM generated_designs WHERE created_at > NOW() - INTERVAL '${interval}' AND stage3_retried = TRUE`),
      db.query(
        `SELECT width_bucket(triangles, 0, 100000, 10) AS bucket, COUNT(*)::int AS n
           FROM generated_designs WHERE triangles IS NOT NULL AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY bucket ORDER BY bucket`
      ),
    ]);
    const total = tot.rows[0]?.n || 0;
    return {
      range, total,
      watertight_pct: total ? (water.rows[0].n / total) * 100 : 0,
      retried_pct: total ? (retr.rows[0].n / total) * 100 : 0,
      tri_buckets: hist.rows,
    };
  },

  // Cost-per-job tracker. Pulls Stripe fee + Resend volume from the
  // existing tables. Approximate; admin uses it as a "watch the
  // wall" gauge, not an accounting source of truth.
  'admin.metrics.cost': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, paid_revenue: 0, paid_count: 0, email_count: 0 };
    const [rev, em] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount_cents),0)::int AS s, COUNT(*)::int AS n FROM purchases WHERE status='paid' AND paid_at > NOW() - INTERVAL '${interval}'`),
      db.query(`SELECT COUNT(*)::int AS n FROM email_events WHERE created_at > NOW() - INTERVAL '${interval}'`),
    ]);
    return {
      range,
      paid_revenue: rev.rows[0].s, paid_count: rev.rows[0].n,
      email_count: em.rows[0].n,
    };
  },

  // Outbound email health from email_events.
  'admin.metrics.email': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const { range } = RangeSchema.parse(payload || {});
    const interval = rangeToInterval(range);
    if (!hasDb()) return { range, by_template: [], by_type: [] };
    const [tpl, typ] = await Promise.all([
      db.query(`SELECT template, COUNT(*)::int AS n FROM email_events WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY template ORDER BY n DESC`),
      db.query(`SELECT type, COUNT(*)::int AS n FROM email_events WHERE created_at > NOW() - INTERVAL '${interval}' GROUP BY type ORDER BY n DESC`),
    ]);
    return { range, by_template: tpl.rows, by_type: typ.rows };
  },

  // Failure corpus — recent stl.generate jobs that errored. Surfaces
  // the photo + slider settings + RunPod job id so the operator can
  // pull the input from /runpod-volume/failures/<date>/<jobId>/ when
  // iterating on the pipeline.
  'admin.metrics.failures': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    const { rows } = await db.query(
      `SELECT created_at, action, target_type, target_id, metadata
         FROM audit_log
        WHERE action LIKE 'cmd.error%' OR action = 'stl.generate.failed'
           OR (action = 'cmd.error' AND metadata->>'name' = 'stl.generate')
        ORDER BY created_at DESC LIMIT 200`
    );
    return { rows };
  },

  // Real-time activity stream — last N events for the live tab.
  'admin.metrics.activity': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    const { rows } = await db.query(
      `SELECT created_at, actor_id, action, target_type, target_id, ip, geo_country, geo_city
         FROM audit_log ORDER BY id DESC LIMIT 50`
    );
    return { rows };
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

  // RunPod multi-region race telemetry. Returns per-endpoint counters
  // (submits / wins / losses / errors / last-win) plus a live ping
  // (reachable / latency per region). The /admin "Regions" tab reads
  // this to render the race-winner pie + reachability table.
  'admin.metrics.runpod': async ({ socket }) => {
    requireAdmin({ socket });
    const [ping] = await Promise.all([pingRunpod()]);
    const telemetry = getRunpodTelemetry();
    return {
      // Telemetry rows are the source of truth for win-rate. Endpoints
      // that have never been raced won't appear here yet.
      endpoints: telemetry,
      // Live reachability — surfaces endpoints even before they've
      // served a request, so the operator can see they're configured.
      ping,
    };
  },

  // v0.1.42 — per-stage user feedback aggregator. Powers the /admin
  // Feedback tab. Returns per-stage rating distributions plus the
  // most-recent N feedback rows joined to design metadata so the
  // operator can spot quality issues without manually combing the DB.
  //
  // Two queries:
  //   1. Aggregate counts grouped by (stage, rating).
  //   2. Recent feedback rows with design + account context, capped
  //      at 100 to keep payload sane.
  //
  // The "down" rate per stage is the headline number — that's the one
  // operators look at to decide whether the boolean phase is failing
  // more than usual.
  'admin.metrics.feedback': async ({ socket, payload }) => {
    requireAdmin({ socket });
    const Schema = z.object({
      range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
      limit: z.number().int().min(1).max(200).default(50),
    });
    const { range, limit } = Schema.parse(payload || {});
    if (!hasDb()) {
      return { aggregates: [], recent: [], range, limit };
    }
    const rangeClause = range === 'all'
      ? ''
      : `AND df.created_at >= NOW() - INTERVAL '${range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days'}'`;
    const aggSql = `
      SELECT df.stage, df.rating, COUNT(*)::int AS n
        FROM design_feedback df
       WHERE 1=1 ${rangeClause}
       GROUP BY df.stage, df.rating
       ORDER BY df.stage, df.rating
    `;
    const recentSql = `
      SELECT df.id, df.design_id, df.stage, df.rating, df.reason,
             df.created_at,
             gd.photo_name, gd.filename, gd.final_failed, gd.final_error,
             a.email AS account_email, a.username AS account_username
        FROM design_feedback df
        LEFT JOIN generated_designs gd ON gd.id = df.design_id
        LEFT JOIN accounts a ON a.id = df.account_id
       WHERE 1=1 ${rangeClause}
       ORDER BY df.created_at DESC
       LIMIT $1
    `;
    const [aggRes, recentRes] = await Promise.all([
      db.query(aggSql),
      db.query(recentSql, [limit]),
    ]);
    return {
      aggregates: aggRes.rows,
      recent: recentRes.rows,
      range,
      limit,
    };
  },
};

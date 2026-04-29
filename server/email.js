// P1-001 / P2-008 — email delivery wrapper.
//
// Backends:
//   - resend (default if RESEND_API_KEY is set)
//   - postmark (if POSTMARK_TOKEN is set)
//   - console (dev fallback; just logs the email and a copy-pasteable URL)
//
// Honours P1-007 prefs: each call may pass `pref` ('marketing',
// 'order_updates', 'design_reminders'). Transactional sends pass nothing
// (or 'transactional') and bypass the prefs check.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import { db, hasDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, 'emails');
const FROM = process.env.EMAIL_FROM || 'ValveHeadZ <noreply@valveheadz.test>';

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY || process.env.POSTMARK_TOKEN);
}

export async function sendEmail({
  to,
  template,
  data = {},
  pref = null,
  attachments = [],
  accountId = null,
  subjectOverride = null,
}) {
  if (!to) {
    logger.warn({ msg: 'email.skip', reason: 'no_recipient' });
    return { ok: false, reason: 'no_recipient' };
  }
  if (pref && hasDb() && accountId) {
    const { rows } = await db.query(`SELECT email_prefs FROM accounts WHERE id = $1`, [accountId]).catch(
      () => ({ rows: [] })
    );
    const prefs = rows[0]?.email_prefs || {};
    if (prefs[pref] === false) {
      logger.info({ msg: 'email.skipped_pref', pref, accountId });
      return { ok: false, reason: 'opted_out' };
    }
  }

  const rendered = renderTemplate(template, data);
  const subject = subjectOverride || rendered.subject || template;

  if (!emailEnabled()) {
    logger.info({
      msg: 'email.console',
      to,
      template,
      subject,
      data: redact(data),
      preview: rendered.text?.slice(0, 200),
    });
    return { ok: true, backend: 'console' };
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: Array.isArray(to) ? to : [to],
          subject,
          html: rendered.html,
          text: rendered.text,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn({ msg: 'email.resend_error', status: res.status, body });
        return { ok: false, reason: 'provider_error', status: res.status };
      }
      logger.info({ msg: 'email.sent', backend: 'resend', template, to, id: body?.id });
      await persistEmailEvent({ accountId, template, type: 'queued', metadata: { id: body?.id } });
      return { ok: true, backend: 'resend', id: body?.id };
    } catch (err) {
      logger.error({ msg: 'email.resend_throw', err: err.message });
      return { ok: false, reason: 'provider_throw' };
    }
  }

  // Postmark fallback
  if (process.env.POSTMARK_TOKEN) {
    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          From: FROM,
          To: Array.isArray(to) ? to.join(',') : to,
          Subject: subject,
          HtmlBody: rendered.html,
          TextBody: rendered.text,
          MessageStream: process.env.POSTMARK_STREAM || 'outbound',
          Attachments: attachments.map((a) => ({
            Name: a.filename,
            Content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
            ContentType: a.contentType || 'application/octet-stream',
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn({ msg: 'email.postmark_error', status: res.status, body });
        return { ok: false, reason: 'provider_error' };
      }
      logger.info({ msg: 'email.sent', backend: 'postmark', template, to, id: body?.MessageID });
      await persistEmailEvent({ accountId, template, type: 'queued', metadata: { id: body?.MessageID } });
      return { ok: true, backend: 'postmark', id: body?.MessageID };
    } catch (err) {
      logger.error({ msg: 'email.postmark_throw', err: err.message });
      return { ok: false, reason: 'provider_throw' };
    }
  }
  return { ok: false, reason: 'no_provider' };
}

function renderTemplate(name, data) {
  const html = readTemplate(`${name}.html`) ?? readTemplate('default.html');
  const text = readTemplate(`${name}.txt`) ?? readTemplate('default.txt');
  const subjectFile = readTemplate(`${name}.subject`);
  return {
    subject: subjectFile ? interpolate(subjectFile, data).trim() : null,
    html: html ? interpolate(html, data) : null,
    text: text ? interpolate(text, data) : `Template ${name}: ${JSON.stringify(redact(data))}`,
  };
}

function readTemplate(filename) {
  try {
    return fs.readFileSync(path.join(TEMPLATE_DIR, filename), 'utf8');
  } catch {
    return null;
  }
}

function interpolate(template, data) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.');
    let v = data;
    for (const p of parts) v = v?.[p];
    return v == null ? '' : String(v);
  });
}

function redact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) out[k] = `[bytes:${v.length}]`;
    else if (typeof v === 'string' && v.length > 256) out[k] = v.slice(0, 256) + '…';
    else out[k] = v;
  }
  return out;
}

async function persistEmailEvent({ accountId, template, type, metadata }) {
  if (!hasDb()) return;
  try {
    await db.query(
      `INSERT INTO email_events (message_id, account_id, template, type, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [metadata?.id || null, accountId, template, type, metadata || {}]
    );
  } catch (err) {
    logger.debug({ msg: 'email.event_persist_failed', err: err.message });
  }
}

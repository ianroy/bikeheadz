// Lightweight ip → country/city resolver backed by ipinfo.io's free tier
// (50K req/mo, no key required for the lite endpoint). Used by the page-
// view middleware + login handler to populate the world-map data.
//
// Lookups are cached in-process for 24h so a returning visitor doesn't
// burn a quota call per page hit. Failures fall back to nulls — geo data
// is decorative for analytics, never load-bearing for serving the request.

import { logger } from './logger.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // ip → { value, at }

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc/,
  /^fd/,
];

function isPrivate(ip) {
  if (!ip) return true;
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

export async function geoLookup(ip) {
  if (!ip || isPrivate(ip)) return { country: null, city: null };
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const token = process.env.IPINFO_TOKEN || '';
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`
    : `https://ipinfo.io/${encodeURIComponent(ip)}/json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const value = { country: null, city: null };
      cache.set(ip, { value, at: Date.now() });
      return value;
    }
    const body = await res.json();
    const value = {
      country: body.country || null,
      city: body.city || null,
      region: body.region || null,
      loc: body.loc || null,  // "lat,lng"
    };
    cache.set(ip, { value, at: Date.now() });
    return value;
  } catch (err) {
    logger.debug({ msg: 'geo.lookup_failed', err: err.message, ip });
    const value = { country: null, city: null };
    cache.set(ip, { value, at: Date.now() });
    return value;
  }
}

// Fire-and-forget variant that updates an audit_log or page_view row
// AFTER the response has been sent. Returns the resolution promise so
// the caller can await if it cares about the result.
export function geoLookupAsync(ip) {
  return geoLookup(ip).catch(() => ({ country: null, city: null }));
}

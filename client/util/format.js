// P6-012 — Locale-aware Intl formatting helpers.
//
// All helpers accept an optional `locale` override; otherwise they fall
// back to whatever `getLocale()` reports. None of these helpers throw
// on bad input — they return a safe string ('—') so they're safe to
// render unconditionally inside templates.

import { getLocale } from '../i18n/index.js';

const SAFE = '—';

function pickLocale(locale) {
  return locale ?? getLocale();
}

export function fmtDate(d, locale) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return SAFE;
  try {
    return new Intl.DateTimeFormat(pickLocale(locale), {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

// Buckets in seconds → Intl.RelativeTimeFormat unit + divisor.
const REL_BUCKETS = [
  { limit: 60,            unit: 'second', div: 1 },
  { limit: 60 * 60,       unit: 'minute', div: 60 },
  { limit: 60 * 60 * 24,  unit: 'hour',   div: 60 * 60 },
  { limit: 60 * 60 * 24 * 7,  unit: 'day',   div: 60 * 60 * 24 },
  { limit: 60 * 60 * 24 * 30, unit: 'week',  div: 60 * 60 * 24 * 7 },
  { limit: 60 * 60 * 24 * 365,unit: 'month', div: 60 * 60 * 24 * 30 },
  { limit: Infinity,          unit: 'year',  div: 60 * 60 * 24 * 365 },
];

export function fmtRelative(d, locale) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return SAFE;
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const bucket = REL_BUCKETS.find((b) => absSec < b.limit) || REL_BUCKETS[REL_BUCKETS.length - 1];
  const value = Math.round(diffSec / bucket.div);
  try {
    return new Intl.RelativeTimeFormat(pickLocale(locale), { numeric: 'auto' })
      .format(value, bucket.unit);
  } catch {
    return fmtDate(date, locale);
  }
}

export function fmtNumber(n, locale) {
  if (n == null || Number.isNaN(Number(n))) return SAFE;
  try {
    return new Intl.NumberFormat(pickLocale(locale)).format(Number(n));
  } catch {
    return String(n);
  }
}

export function fmtCurrency(cents, currency = 'USD', locale) {
  if (cents == null || Number.isNaN(Number(cents))) return SAFE;
  const amount = Number(cents) / 100;
  try {
    return new Intl.NumberFormat(pickLocale(locale), {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

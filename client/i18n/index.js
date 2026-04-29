// P6-002 — Translation scaffolding.
//
// Plain ESM, eager imports — no dynamic locale loading. Dictionaries are
// flat string-keyed objects (e.g. 'nav.home': 'Home'); see ./en.js for
// the canonical key set.
//
// Usage:
//   import { t, setLocale, getLocale } from './i18n/index.js';
//   t('cta.generate');           // → 'Generate' / 'Generar'
//   t('share.copied');           // → 'Link copied'
//   setLocale('es');             // emits window 'vh:localechange'
//
// Variable interpolation uses {name} placeholders:
//   t('greeting', { name: 'Sam' })  // dict: 'greeting': 'Hi {name}!'

import en from './en.js';
import es from './es.js';

export const availableLocales = ['en', 'es'];

const dictionaries = { en, es };

const FALLBACK = 'en';
const STORAGE_KEY = 'vh_locale';

function detectLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && availableLocales.includes(stored)) return stored;
  } catch { /* localStorage unavailable */ }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const code = navigator.language.split('-')[0];
    if (availableLocales.includes(code)) return code;
  }
  return FALLBACK;
}

let currentLocale = detectLocale();

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (!availableLocales.includes(locale)) return;
  currentLocale = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vh:localechange', { detail: { locale } }));
  }
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m
  );
}

export function t(key, vars) {
  const dict = dictionaries[currentLocale];
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
    return interpolate(dict[key], vars);
  }
  const fallback = dictionaries[FALLBACK];
  if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) {
    return interpolate(fallback[key], vars);
  }
  return key;
}

// X-014 — /changelog and /incidents pages.
//
// Both render markdown that ships with the bundle via Vite's `?raw`
// query — no fetch round-trip, no markdown library dependency. The
// inline converter below handles only the subset we use in those
// docs: ATX headings, paragraphs, bullet lists, links, and inline
// `code`. Anything fancier (tables, images, fenced code blocks) gets
// rendered as plain text — fine for human-edited release notes.

import { el } from '../dom.js';
import changelogMd from '../../docs/CHANGELOG.md?raw';
import incidentsMd from '../../docs/INCIDENTS.md?raw';

// HTML-escape the four characters we care about. Use this on every
// piece of source-derived text before any further mutation; subsequent
// regex substitutions can then safely emit raw tags.
function esc(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Apply inline-level transforms to a paragraph or list-item's text.
// Order matters: handle code first (so its contents are not turned into
// links) and links last.
function inline(text) {
  let out = esc(text);
  // `inline code`
  out = out.replace(
    /`([^`]+?)`/g,
    (_, code) =>
      `<code style="background:#F1ECE2;padding:1px 6px;border-radius:4px;font-size:0.92em;color:#D89E2F;">${code}</code>`
  );
  // [text](url) — only http(s) and relative paths.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, href) => {
      const safeHref = href.startsWith('http') || href.startsWith('/') || href.startsWith('#')
        ? href
        : '#';
      return `<a href="${safeHref}" style="color:#7B2EFF;text-decoration:underline;">${label}</a>`;
    }
  );
  return out;
}

// Convert a markdown string to an HTML string. Block-level rules:
// blank line → paragraph break; leading `#`s → heading levels; leading
// `- ` lines → unordered list; everything else → paragraph.
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^---+\s*$/.test(line)) {
      out.push(
        '<hr style="border:none;border-top:1px solid #D7CFB6;margin:32px 0;" />'
      );
      i++;
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const fontSize = { 1: '32px', 2: '22px', 3: '18px', 4: '16px', 5: '15px', 6: '14px' }[level];
      const margin = { 1: '8px', 2: '24px', 3: '20px', 4: '16px', 5: '12px', 6: '12px' }[level];
      const color = level === 1 ? '#7B2EFF' : '#0E0A12';
      const weight = level <= 2 ? '700' : '600';
      out.push(
        `<h${level} style="font-size:${fontSize};margin-top:${margin};margin-bottom:8px;color:${color};font-weight:${weight};">${inline(heading[2])}</h${level}>`
      );
      i++;
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      const items = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        items.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        `<blockquote style="border-left:3px solid #D7CFB6;padding:8px 14px;margin:12px 0;color:#3D2F4A;background:#F5F2E5;border-radius:0 8px 8px 0;">${inline(items.join(' '))}</blockquote>`
      );
      continue;
    }

    // Bullet list — collect consecutive `- ` lines.
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      out.push(
        `<ul style="margin:8px 0 12px;padding-left:22px;line-height:1.6;">${items
          .map((it) => `<li style="margin-bottom:4px;">${inline(it)}</li>`)
          .join('')}</ul>`
      );
      continue;
    }

    // Paragraph — collect consecutive non-blank, non-special lines.
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      `<p style="margin:0 0 14px;line-height:1.65;">${inline(para.join(' '))}</p>`
    );
  }
  return out.join('\n');
}

function markdownPage(markdown) {
  const root = el('main', {
    style: {
      maxWidth: '760px',
      margin: '48px auto',
      padding: '0 24px',
      color: 'var(--ink, #0E0A12)',
    },
  });
  // Renderer output is built from escaped text + the small fixed set of
  // tags above; safe for innerHTML.
  const article = el('article', { html: mdToHtml(markdown) });
  root.appendChild(article);
  return { el: root };
}

export function ChangelogPage() {
  return markdownPage(changelogMd);
}

export function IncidentsPage() {
  return markdownPage(incidentsMd);
}

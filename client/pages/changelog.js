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

// Pinned brand hexes — see brandstandards.MD §14. Inline so the markdown
// renderer doesn't depend on any flipping CSS variable (avoids the same
// dark-mode invisi-text bug we hit on /sixpack).
const PAPER     = '#F5F2E5';
const PAPER_SOFT= '#E5E0CC';
const INK       = '#0E0A12';
const INK_MUTED = '#3D2F4A';
const BRAND     = '#7B2EFF';
const ACCENT2   = '#2EFF8C';
const ACCENT3   = '#FF2EAB';

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
  // **bold**
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  // *italic* (single-star — must come after the bold replacement)
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  // `inline code`
  out = out.replace(
    /`([^`]+?)`/g,
    (_, code) =>
      `<code style="background:${PAPER};padding:1px 6px;border-radius:4px;font-size:0.92em;color:${BRAND};border:1px solid ${INK};">${code}</code>`
  );
  // [text](url) — only http(s) and relative paths.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, href) => {
      const safeHref = href.startsWith('http') || href.startsWith('/') || href.startsWith('#')
        ? href
        : '#';
      return `<a href="${safeHref}" style="color:${BRAND};text-decoration:underline;text-decoration-thickness:2px;font-weight:600;">${label}</a>`;
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

    // Horizontal rule — dashed ink line, gives the page a catalog-zine vibe.
    if (/^---+\s*$/.test(line)) {
      out.push(
        `<hr style="border:none;border-top:2px dashed ${INK};margin:32px 0;" />`
      );
      i++;
      continue;
    }

    // Heading. h1 = page title (italic display + tri-shadow), h2 = version
    // header (italic display + single accent shadow), h3+ = body section.
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) {
        out.push(
          `<h1 style="font-family:'Anton', sans-serif;font-style:italic;font-weight:900;font-size:clamp(2.4rem, 5vw, 3.4rem);color:${INK};text-shadow:5px 5px 0 ${ACCENT2}, 9px 9px 0 ${BRAND};margin:0 0 8px;line-height:0.92;text-transform:uppercase;letter-spacing:-0.02em;">${inline(heading[2])}</h1>`
        );
      } else if (level === 2) {
        out.push(
          `<h2 style="font-family:'Anton', sans-serif;font-style:italic;font-weight:900;font-size:clamp(1.4rem, 2.6vw, 1.7rem);color:${INK};text-shadow:3px 3px 0 ${ACCENT3};margin:32px 0 12px;line-height:1.05;text-transform:uppercase;letter-spacing:-0.01em;">${inline(heading[2])}</h2>`
        );
      } else {
        const fontSize = { 3: '1.05rem', 4: '0.98rem', 5: '0.92rem', 6: '0.88rem' }[level];
        out.push(
          `<h${level} style="font-size:${fontSize};margin:18px 0 8px;color:${INK};font-weight:700;font-style:italic;text-transform:uppercase;letter-spacing:0.04em;">${inline(heading[2])}</h${level}>`
        );
      }
      i++;
      continue;
    }

    // Blockquote — italic asides on a paper-soft beige strip.
    if (/^>\s?/.test(line)) {
      const items = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        items.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        `<blockquote style="border-left:4px solid ${BRAND};padding:10px 16px;margin:14px 0;color:${INK};background:${PAPER};border-radius:0 6px 6px 0;font-style:italic;">${inline(items.join(' '))}</blockquote>`
      );
      continue;
    }

    // Bullet list — collect consecutive `- ` lines. Custom bullet via
    // ::marker color so the disc reads as fluoro-green on cream.
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      out.push(
        `<ul style="margin:10px 0 14px;padding-left:22px;line-height:1.65;color:${INK};">${items
          .map((it) => `<li style="margin-bottom:6px;">${inline(it)}</li>`)
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
      `<p style="margin:0 0 14px;line-height:1.65;color:${INK};">${inline(para.join(' '))}</p>`
    );
  }
  return out.join('\n');
}

// ── Brand-styled shell for /changelog and /incidents ──────────────────────
//
// Pinned-light paper-soft section bg with a beige paper card on top so the
// markdown article reads on the same brand surface as the rest of the
// site (matches /sixpack and /press).

function markdownPage(markdown, opts = {}) {
  const root = el('div', {
    class: 'sdzr-bg-paper-soft',
    style: { padding: '48px 0 64px', borderTop: '3px solid ' + INK, borderBottom: '3px solid ' + INK },
  });

  const wrap = el('main', {
    style: {
      maxWidth: '880px',
      margin: '0 auto',
      padding: '0 24px',
      color: INK,
      position: 'relative',
    },
  });
  root.appendChild(wrap);

  // Eyebrow + sticker chrome above the article card.
  wrap.appendChild(el('span', {
    style: {
      display: 'inline-block',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.78rem',
      fontWeight: 700,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: BRAND,
      marginBottom: '6px',
    },
  }, opts.eyebrow || 'WHAT WE SHIPPED · WEEK BY WEEK'));

  if (opts.sticker) {
    wrap.appendChild(el('span', {
      style: {
        position: 'absolute',
        top: '0',
        right: '24px',
        background: ACCENT3,
        color: INK,
        border: '2px solid ' + INK,
        padding: '4px 10px',
        fontFamily: 'Anton, sans-serif',
        fontStyle: 'italic',
        fontWeight: 900,
        fontSize: '0.74rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        transform: 'rotate(8deg)',
        boxShadow: '3px 3px 0 ' + INK,
        whiteSpace: 'nowrap',
      },
    }, opts.sticker));
  }

  // The article body — beige paper card so the markdown sits on the
  // same surface treatment as the rest of the operator pages.
  const article = el('article', {
    style: {
      background: PAPER,
      border: '2px solid ' + INK,
      borderRadius: '12px',
      padding: '24px 28px 32px',
      marginTop: '8px',
    },
    html: mdToHtml(markdown),
  });
  wrap.appendChild(article);

  return { el: root };
}

export function ChangelogPage() {
  return markdownPage(changelogMd, {
    eyebrow: 'WHAT WE SHIPPED · WEEK BY WEEK',
    sticker: 'LIVE LOG',
  });
}

export function IncidentsPage() {
  return markdownPage(incidentsMd, {
    eyebrow: 'POSTMORTEMS · WHAT BROKE · HOW WE FIXED IT',
    sticker: 'TRUST LOG',
  });
}

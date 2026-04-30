/* sdz-radical.js — vanilla, no deps. Pairs with sdz-radical.css.
   Wires:
     · Wordmark hover splatter
     · Draggable stickers
     · Click-to-spin valve cap (drag-to-rotate, momentum-free)
     · Halftone / splatter density tweakable via data attributes + CSS vars
     · Calm-mode toggle (.sdz-calm on <html>)
   Activate by including the script and calling SDZRadical.init(root?). */
(function (global) {
  'use strict';

  const PALETTE = ['#7B2EFF', '#2EFF8C', '#FF2EAB', '#0E0A12'];

  // ── Wordmark splatter burst ────────────────────────────────────────────
  function wireWordmark(el) {
    if (el.__sdzrWired) return;
    el.__sdzrWired = true;
    const burst = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    burst.classList.add('sdzr-burst');
    burst.setAttribute('viewBox', '-50 -50 100 100');
    burst.setAttribute('preserveAspectRatio', 'none');
    burst.style.width = '100%'; burst.style.height = '100%';
    burst.style.position = 'absolute'; burst.style.inset = '0';
    el.style.overflow = 'visible';
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const r = 35 + Math.random() * 35;
      const dx = Math.cos(a) * r, dy = Math.sin(a) * r - 10;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '0'); c.setAttribute('cy', '0');
      c.setAttribute('r', String(2 + Math.random() * 4));
      c.setAttribute('fill', PALETTE[i % PALETTE.length]);
      c.style.setProperty('--sdzr-burst-end', `translate(${dx}px, ${dy}px)`);
      c.style.animationDelay = (Math.random() * 80) + 'ms';
      burst.appendChild(c);
    }
    el.appendChild(burst);
  }

  // ── Draggable stickers ──────────────────────────────────────────────────
  function wireSticker(el) {
    if (el.__sdzrDrag) return;
    el.__sdzrDrag = true;
    let startX, startY, ox = 0, oy = 0, dragging = false;
    const r = el.getBoundingClientRect();
    el.style.position = el.style.position || 'absolute';
    function onDown(e) {
      dragging = true;
      const p = pt(e);
      startX = p.x; startY = p.y;
      const m = /translate\(([^,]+)px,\s*([^)]+)px\)/.exec(el.style.transform || '');
      ox = m ? parseFloat(m[1]) : 0;
      oy = m ? parseFloat(m[2]) : 0;
      el.style.zIndex = '40';
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const p = pt(e);
      const tx = ox + (p.x - startX);
      const ty = oy + (p.y - startY);
      el.style.transform = `translate(${tx}px, ${ty}px) rotate(${el.dataset.rot || 0}deg)`;
    }
    function onUp() { dragging = false; }
    function pt(e) {
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }
    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  // ── Click-to-spin valve cap (CSS-3D, no Three) ──────────────────────────
  function wireCap(el) {
    if (el.__sdzrCap) return;
    el.__sdzrCap = true;
    let dragging = false, sx = 0, ry = 0, rxBase = -12, ryBase = 0;
    function down(e) {
      dragging = true;
      el.style.animation = 'none';
      sx = (e.touches ? e.touches[0].clientX : e.clientX);
      const m = /rotateY\(([-\d.]+)deg\)/.exec(el.style.transform || '');
      ryBase = m ? parseFloat(m[1]) : 0;
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      ry = ryBase + (x - sx) * 0.6;
      el.style.transform = `rotateY(${ry}deg) rotateX(${rxBase}deg)`;
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      // resume idle spin from current angle
      el.style.transform = `rotateY(${ry}deg) rotateX(${rxBase}deg)`;
      el.style.animation = '';
      el.style.animationDelay = `${-((ry % 360) / 360) * 9}s`;
    }
    el.addEventListener('mousedown', down);
    el.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  }

  // ── Splatter dots in containers ─────────────────────────────────────────
  function paintSplatter(svg, count) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < count; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(Math.random() * 100));
      c.setAttribute('cy', String(Math.random() * 100));
      c.setAttribute('r', String(0.4 + Math.random() * 1.4));
      c.setAttribute('fill', PALETTE[Math.floor(Math.random() * 3)]);
      c.setAttribute('opacity', String(0.55 + Math.random() * 0.45));
      svg.appendChild(c);
    }
  }
  function refreshSplatter(root, count) {
    root.querySelectorAll('svg.sdzr-splatter').forEach(s => paintSplatter(s, count));
  }

  // ── Calm mode toggle ────────────────────────────────────────────────────
  function setCalm(on) {
    document.documentElement.classList.toggle('sdz-calm', !!on);
    try { localStorage.setItem('sdz-calm', on ? '1' : '0'); } catch (e) {}
  }
  function getCalm() {
    try { return localStorage.getItem('sdz-calm') === '1'; } catch (e) { return false; }
  }

  function init(root) {
    root = root || document;
    root.querySelectorAll('.sdzr-wordmark').forEach(wireWordmark);
    root.querySelectorAll('.sdzr-sticker').forEach(wireSticker);
    root.querySelectorAll('.sdzr-cap').forEach(wireCap);
    refreshSplatter(root, 80);
  }

  global.SDZRadical = { init, setCalm, getCalm, refreshSplatter, paintSplatter };
})(window);

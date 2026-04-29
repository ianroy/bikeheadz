// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { el, parseTag, clear } from '../../client/dom.js';

describe('parseTag', () => {
  it('parses a bare tag name', () => {
    expect(parseTag('div')).toEqual({ name: 'div', classes: [], id: '' });
  });

  it('parses class shorthand', () => {
    expect(parseTag('span.text-sm.font-bold')).toEqual({
      name: 'span',
      classes: ['text-sm', 'font-bold'],
      id: '',
    });
  });

  it('parses id shorthand', () => {
    expect(parseTag('section#main')).toEqual({ name: 'section', classes: [], id: 'main' });
  });

  it('treats backslash as escape so Tailwind decimal utilities survive', () => {
    expect(parseTag('div.gap-1\\.5')).toEqual({
      name: 'div',
      classes: ['gap-1.5'],
      id: '',
    });
  });

  it('handles mixed classes + id', () => {
    expect(parseTag('button.btn.btn-primary#submit')).toEqual({
      name: 'button',
      classes: ['btn', 'btn-primary'],
      id: 'submit',
    });
  });
});

describe('el', () => {
  it('builds an element with classes and id', () => {
    const node = el('div.card.p-4#hero');
    expect(node.tagName).toBe('DIV');
    expect(node.classList.contains('card')).toBe(true);
    expect(node.classList.contains('p-4')).toBe(true);
    expect(node.id).toBe('hero');
  });

  it('appends string children as text nodes', () => {
    const node = el('p', {}, 'hello ', 'world');
    expect(node.textContent).toBe('hello world');
  });

  it('appends nested elements', () => {
    const inner = el('span', {}, 'inner');
    const outer = el('div', {}, inner);
    expect(outer.firstChild).toBe(inner);
  });

  it('skips falsy children', () => {
    const node = el('p', {}, false, null, undefined, 'kept');
    expect(node.textContent).toBe('kept');
  });

  it('attaches event listeners via on*', () => {
    let called = 0;
    const node = el('button', { onClick: () => called++ });
    node.click();
    expect(called).toBe(1);
  });

  it('omits falsy attributes', () => {
    const node = el('input', { disabled: false, required: null });
    expect(node.hasAttribute('disabled')).toBe(false);
    expect(node.hasAttribute('required')).toBe(false);
  });

  it('clear() empties a node', () => {
    const node = el('ul', {}, el('li', {}, 'a'), el('li', {}, 'b'));
    expect(node.childNodes.length).toBe(2);
    clear(node);
    expect(node.childNodes.length).toBe(0);
  });
});

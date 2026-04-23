// Tiny hyperscript-style DOM builder used everywhere instead of JSX.
//
//   el('div.card.p-4', { onClick }, 'Hello', el('span', {}, 'world'))
//
// The tag string supports `.class` and `#id` shorthand. A literal `.` inside
// a class name (e.g. Tailwind's `gap-1.5`) must be escaped as `\.` in the JS
// source — `el('div.mt-1\\.5', …)`.
//
// Attributes map to DOM properties when available (so `value`, `checked`,
// etc. work) and to attributes otherwise. `style` accepts an object. `on*`
// attributes attach listeners. `html` sets innerHTML. Children may be
// strings, numbers, Nodes, arrays, false, null, or undefined — falsy values
// are skipped.

export function el(tag, attrs, ...children) {
  const { name, classes, id } = parseTag(tag);
  const node = document.createElement(name);
  for (const c of classes) node.classList.add(c);
  if (id) node.id = id;

  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    applyAttrs(node, attrs);
  } else if (attrs != null) {
    children.unshift(attrs);
  }
  appendAll(node, children);
  return node;
}

// Parses `div.a.b\.5#id` into { name: 'div', classes: ['a', 'b.5'], id: 'id' }.
// Handles backslash-escaped separators so Tailwind's decimal utilities
// (gap-1.5 etc.) can appear in class names.
function parseTag(tag) {
  let i = 0;
  let name = '';
  while (i < tag.length && tag[i] !== '.' && tag[i] !== '#') {
    name += tag[i++];
  }
  const classes = [];
  let id = '';
  while (i < tag.length) {
    const marker = tag[i++];
    let token = '';
    while (i < tag.length) {
      if (tag[i] === '\\' && tag[i + 1] !== undefined) {
        token += tag[i + 1];
        i += 2;
        continue;
      }
      if (tag[i] === '.' || tag[i] === '#') break;
      token += tag[i++];
    }
    if (marker === '.') classes.push(token);
    else if (marker === '#') id = token;
  }
  return { name, classes, id };
}

function applyAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      const list = Array.isArray(value) ? value : String(value).split(/\s+/);
      for (const c of list) if (c) node.classList.add(c);
    } else if (key === 'style') {
      if (typeof value === 'string') node.setAttribute('style', value);
      else Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'ref' && typeof value === 'function') {
      value(node);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && typeof node[key] !== 'function' && !isAttrOnlyProp(key)) {
      try { node[key] = value; } catch { node.setAttribute(key, value); }
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
}

// Some property names need to stay as attributes (e.g. SVG-only or custom).
function isAttrOnlyProp(key) {
  return key === 'for' || key === 'role' || key.startsWith('aria-') || key.startsWith('data-');
}

export function appendAll(parent, items) {
  for (const item of items) {
    if (item == null || item === false) continue;
    if (Array.isArray(item)) appendAll(parent, item);
    else if (item instanceof Node) parent.appendChild(item);
    else parent.appendChild(document.createTextNode(String(item)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

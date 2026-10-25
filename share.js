// TuckMe shared lists. The list lives in the link after "#": it is read here,
// in the browser, and never sent to any server.

// The landing page: what TuckMe is, and the Android download.
const GET_TUCK = 'https://tuckme.app/';

// No real link is longer; a real list inflates to a few KB. Both stop a
// crafted link from filling the browser's memory.
const MAX_PAYLOAD = 16000;
const MAX_INFLATED = 256 * 1024;

/** Reads [stream] to text, giving up past [limit] bytes. */
async function readCapped(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error('Shared list is too big');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

// The same pastels as the app's category colours (CategoryPalette, light).
const PALETTE = [
  '#BDDCF3', '#F9CFA6', '#F4BFD8', '#CFE0B5', '#B5E6E6',
  '#E6D5B8', '#E3C4F0', '#D5D9E0', '#F6B9A8',
];

/** The shared list in [payload], or null if it is not a whole version-1 list. */
export async function decodePayload(payload) {
  try {
    if (!payload || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) {
      return null;
    }
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    // The app compresses with zlib, which is DecompressionStream's 'deflate'.
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'));
    const json = JSON.parse(await readCapped(stream, MAX_INFLATED));
    if (!json || json.v !== 1 || typeof json.n !== 'string' || !json.n.trim()) {
      return null;
    }
    if (!Array.isArray(json.p)) return null;
    const tags = (v) => (typeof v === 'string' && v ? v.split(',') : []);
    const num = (v) => (typeof v === 'number' ? v : null);
    const str = (v) => (typeof v === 'string' ? v : '');
    const places = json.p
      .filter((p) => p && typeof p.t === 'string' && typeof p.u === 'string')
      .map((p) => ({
        title: p.t,
        url: p.u,
        address: str(p.a),
        userLocation: str(p.l),
        lat: num(p.y),
        lng: num(p.x),
        userTags: tags(p.g),
        tags: tags(p.r),
      }));
    if (!places.length) return null;
    return {
      name: json.n,
      colorIndex: Number.isInteger(json.c) ? json.c : 0,
      places,
    };
  } catch {
    // Cut short, re-encoded by a chat app, or not a TuckMe link at all.
    return null;
  }
}

/** [url] if it is a web link, else null: nothing else is ever made clickable. */
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function el(doc, tag, { text, cls, attrs } = {}, ...kids) {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (kids.length) e.append(...kids);
  return e;
}

function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function header(doc) {
  return el(doc, 'header', { cls: 'brand' },
    el(doc, 'span', { cls: 'logo', attrs: { 'aria-hidden': 'true' } }),
    el(doc, 'span', { text: 'TuckMe', cls: 'brand-name' }));
}

function getTuck(doc, isIphone) {
  return isIphone
    ? el(doc, 'p', { text: 'TuckMe for iPhone is coming soon', cls: 'soon' })
    : el(doc, 'a', { text: 'Get TuckMe', cls: 'button dark', attrs: { href: GET_TUCK } });
}

/**
 * Builds the page for [list] inside the element with id "app". Every piece of
 * shared text goes in through textContent, so a title can never become markup.
 */
export function render(list, doc, { payload, isIphone }) {
  const root = doc.getElementById('app');
  const n = list.places.length;
  const band = el(doc, 'section', {
    cls: 'band',
    attrs: { style: `background:${PALETTE[Math.abs(list.colorIndex) % PALETTE.length]}` },
  },
  header(doc),
  el(doc, 'h1', { text: list.name }),
  el(doc, 'p', { text: `${n} ${n === 1 ? 'place' : 'places'} shared with you`, cls: 'count' }));

  const rows = list.places.map((p) => {
    const href = safeHref(p.url);
    const detail = p.address || p.userLocation || siteOf(p.url);
    return el(doc, 'li', { cls: 'row' },
      el(doc, 'div', { cls: 'row-text' },
        el(doc, 'div', { text: p.title || siteOf(p.url), cls: 'title' }),
        el(doc, 'div', { text: detail, cls: 'detail' })),
      href
        ? el(doc, 'a', {
          text: 'Open ↗',
          cls: 'open',
          attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
        })
        : el(doc, 'span', { text: '', cls: 'open' }));
  });

  const keep = el(doc, 'section', { cls: 'keep' },
    el(doc, 'h2', { text: 'Keep these in TuckMe' }),
    el(doc, 'p', { text: 'Save them, see them on a map.' }),
    el(doc, 'div', { cls: 'buttons' },
      getTuck(doc, isIphone),
      el(doc, 'a', {
        text: 'Open in TuckMe',
        cls: 'button light',
        attrs: { href: `tuck://share#${payload}` },
      })),
    el(doc, 'p', { text: 'Update TuckMe to open shared lists.', cls: 'note' }));

  root.append(band, el(doc, 'ul', { cls: 'list' }, ...rows), keep);
}

/** What shows when the link is missing or cannot be read. */
export function renderBroken(doc, { isIphone }) {
  doc.getElementById('app').append(
    el(doc, 'section', { cls: 'band broken' },
      header(doc),
      el(doc, 'h1', { text: "This link couldn't be opened." }),
      el(doc, 'p', { text: "Ask for a fresh link, or check it wasn't cut short.", cls: 'count' })),
    el(doc, 'section', { cls: 'keep' },
      el(doc, 'h2', { text: 'Tuck it away. Find it when it counts.' }),
      el(doc, 'div', { cls: 'buttons' }, getTuck(doc, isIphone))));
}

/** Which page a visit shows: a link with anything after "#" is a shared list. */
export function pageFor(hash) {
  return hash && hash.length > 1 ? 'share' : 'landing';
}

// In the browser: a shared list draws its page; without one, the landing page
// in index.html shows as it is.
if (typeof window !== 'undefined' && window.document) {
  const doc = window.document;
  // Pasting a shared link into a tab already on the page only changes the hash.
  window.addEventListener('hashchange', () => window.location.reload());
  if (pageFor(window.location.hash) === 'share') {
    doc.documentElement.classList.add('is-share');
    const payload = window.location.hash.slice(1);
    const isIphone = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
    decodePayload(payload).then((list) => {
      if (list) {
        doc.title = `${list.name} · TuckMe`;
        render(list, doc, { payload, isIphone });
      } else {
        doc.title = 'Shared with you · TuckMe';
        renderBroken(doc, { isIphone });
      }
    });
  }
}

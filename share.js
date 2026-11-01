// TuckMe shared lists. The list lives in the link after "#": it is read here,
// in the browser, and never sent to any server.

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
        thumb: str(p.i),
        image: str(p.m),
      }));
    if (!places.length) return null;
    return {
      name: json.n,
      colorIndex: Number.isInteger(json.c) ? json.c : 0,
      places,
      // One save shared on its own, not a whole category.
      single: json.s === 1,
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

/** What people call the site [url] is on: "Instagram", "Google Maps", or its address. */
export function siteName(url) {
  const host = siteOf(url);
  if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'YouTube';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'TikTok';
  if (/^maps\.app\.goo\.gl$|^goo\.gl$|^maps\.google\./.test(host) || /google\.[a-z.]+$/.test(host) && /\/maps/.test(url)) {
    return 'Google Maps';
  }
  if (/(^|\.)maps\.apple\.com$/.test(host)) return 'Apple Maps';
  return host;
}

/** The button that leaves for the save's own site. */
function openLabel(url) {
  const name = siteName(url);
  if (/Maps$/.test(name)) return `Open in ${name}`;
  return name ? `Open on ${name}` : 'Open the link';
}

/** A thumbnail's data: URL, only for plain base64 (nothing else becomes a src). */
export function thumbSrc(thumb) {
  return typeof thumb === 'string' && thumb && thumb.length <= 8000 && /^[A-Za-z0-9+/]+={0,2}$/.test(thumb)
    ? `data:image/jpeg;base64,${thumb}`
    : null;
}

/** The video's id in a YouTube link (watch, youtu.be, Shorts, live, embed), or null. */
export function youTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/) || [])[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Tiles for saves without a picture: the app's pastels, picked by site.
const TILE = ['#CFCBF5', '#F6B9A8', '#CFE0B5', '#BDDCF3', '#F9CFA6', '#B5E6E6'];

/** A picture's web address from the link, if it is a plain https one. */
export function imageHref(url) {
  try {
    return typeof url === 'string' && url.length <= 400 && new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * The save's picture, in layers: a pastel tile with its site's first letter,
 * the small picture carried in the link, and on top the picture from the web
 * (its address from the link, or a YouTube video's own). A layer that fails
 * to load is taken away, and the one beneath shows.
 */
function picture(doc, p, cls) {
  const name = siteName(p.url) || p.title || '?';
  let h = 0;
  for (const ch of siteOf(p.url)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tile = el(doc, 'span', {
    cls: `${cls} tile`,
    attrs: { style: `background:${TILE[h % TILE.length]}`, 'aria-hidden': 'true' },
  }, el(doc, 'span', { text: name.charAt(0).toUpperCase(), cls: 'tile-letter' }));
  const layer = (src, extra = {}) => {
    const img = el(doc, 'img', { cls: 'tile-photo', attrs: { src, alt: '', ...extra } });
    if (img.addEventListener) img.addEventListener('error', () => img.remove());
    tile.append(img);
  };
  const carried = thumbSrc(p.thumb);
  if (carried) layer(carried);
  const video = youTubeId(p.url);
  const web = imageHref(p.image) || (video ? `https://i.ytimg.com/vi/${video}/mqdefault.jpg` : null);
  if (web) layer(web, { referrerpolicy: 'no-referrer', loading: 'lazy' });
  return tile;
}

/** The save tucked into a TuckMe pocket: back pocket, the picture, the stitched front. */
function pocket(doc, p, label) {
  return el(doc, 'div', { cls: 'pocket', attrs: { 'aria-hidden': 'true' } },
    el(doc, 'span', { cls: 'pocket-back' }),
    el(doc, 'span', { cls: 'pocket-card' }, picture(doc, p, 'pocket-pic')),
    el(doc, 'span', { cls: 'pocket-front' },
      el(doc, 'span', { text: label, cls: 'pocket-label' })));
}

function header(doc) {
  return el(doc, 'header', { cls: 'brand' },
    el(doc, 'span', { cls: 'logo', attrs: { 'aria-hidden': 'true' } }),
    el(doc, 'span', { text: 'TuckMe', cls: 'brand-name' }));
}

/** The app isn't out yet: no download link anywhere, on any phone. */
function getTuck(doc) {
  return el(doc, 'p', { text: 'TuckMe is coming soon', cls: 'soon' });
}

function openInTuck(doc, payload) {
  return el(doc, 'a', {
    text: 'Open in TuckMe',
    cls: 'button dark',
    attrs: { href: `tuck://share#${payload}` },
  });
}

/** One save shared on its own: the save in its pocket, then where to open it. */
function renderOne(p, doc, { payload }) {
  const href = safeHref(p.url);
  const title = p.title || siteName(p.url) || 'A save';
  const where = p.address || p.userLocation;
  const site = siteName(p.url);
  const page = el(doc, 'section', { cls: 'one' },
    header(doc),
    pocket(doc, p, site || 'Saved'),
    el(doc, 'div', { cls: 'one-text' },
      el(doc, 'p', { text: 'Shared with you from TuckMe', cls: 'kicker' }),
      el(doc, 'h1', { text: title }),
      where ? el(doc, 'p', { text: where, cls: 'where' }) : el(doc, 'p', { text: site, cls: 'where' })),
    el(doc, 'div', { cls: 'buttons' },
      openInTuck(doc, payload),
      href
        ? el(doc, 'a', {
          text: openLabel(p.url),
          cls: 'button light',
          attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
        })
        : el(doc, 'span', { text: '' })));
  const keep = el(doc, 'section', { cls: 'keep' },
    el(doc, 'h2', { text: 'Keep it in TuckMe' }),
    el(doc, 'p', { text: 'Tuck it away. Find it when it counts.', cls: 'tagline' }),
    getTuck(doc));
  doc.getElementById('app').append(page, keep);
}

/**
 * Builds the page for [list] inside the element with id "app". Every piece of
 * shared text goes in through textContent, so a title can never become markup.
 */
export function render(list, doc, { payload, isIphone }) {
  if (list.single && list.places.length) {
    renderOne(list.places[0], doc, { payload, isIphone });
    return;
  }
  const root = doc.getElementById('app');
  const n = list.places.length;
  const cover = list.places.find((p) => thumbSrc(p.thumb)) || list.places[0];
  const band = el(doc, 'section', {
    cls: 'band',
    attrs: { style: `background:${PALETTE[Math.abs(list.colorIndex) % PALETTE.length]}` },
  },
  header(doc),
  el(doc, 'div', { cls: 'band-row' },
    el(doc, 'div', { cls: 'band-text' },
      el(doc, 'h1', { text: list.name }),
      el(doc, 'p', { text: `${n} ${n === 1 ? 'place' : 'places'} shared with you`, cls: 'count' })),
    el(doc, 'div', { cls: 'mini' }, pocket(doc, cover, `${n}`))));

  const rows = list.places.map((p) => {
    const href = safeHref(p.url);
    const detail = p.address || p.userLocation || siteName(p.url);
    return el(doc, 'li', { cls: 'row' },
      picture(doc, p, 'row-pic'),
      el(doc, 'div', { cls: 'row-text' },
        el(doc, 'div', { text: p.title || siteName(p.url), cls: 'title' }),
        el(doc, 'div', { text: detail, cls: 'detail' })),
      href
        ? el(doc, 'a', {
          text: 'Open',
          cls: 'open',
          attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
        })
        : el(doc, 'span', { text: '', cls: 'open' }));
  });

  const keep = el(doc, 'section', { cls: 'keep' },
    el(doc, 'h2', { text: 'Keep these in TuckMe' }),
    el(doc, 'p', { text: 'Pick the ones you want, and find them on a map later.' }),
    el(doc, 'div', { cls: 'buttons' }, openInTuck(doc, payload), getTuck(doc)),
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
      el(doc, 'div', { cls: 'buttons' }, getTuck(doc))));
}

/**
 * What shows at tuckme.app with no list in the link, while the app isn't out:
 * the icon's T tucking into its pocket and peeking out now and then, the
 * tagline, and "Coming soon" stitched onto a little pocket.
 */
export function renderHome(doc) {
  const pocket = el(doc, 'div', { cls: 'tuck-icon', attrs: { 'aria-hidden': 'true' } },
    el(doc, 'span', { cls: 'ti-back' }),
    el(doc, 'span', { cls: 'ti-t' },
      el(doc, 'span', { cls: 'ti-bar' }),
      el(doc, 'span', { cls: 'ti-stem' })),
    el(doc, 'span', { cls: 'ti-front' }));
  doc.getElementById('app').append(
    el(doc, 'section', { cls: 'home' },
      pocket,
      el(doc, 'h1', { cls: 'home-title' },
        el(doc, 'span', { text: 'Tuck it away.' }),
        el(doc, 'span', { text: 'Find it when it counts.', cls: 'serif' })),
      el(doc, 'p', { text: 'Coming soon', cls: 'soon-pocket' })));
}

// In the browser: read the link and draw the page.
if (typeof window !== 'undefined' && window.document) {
  const doc = window.document;
  const payload = window.location.hash.slice(1);
  const isIphone = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
  // Pasting a shared link into a tab already on the page only changes the hash.
  window.addEventListener('hashchange', () => window.location.reload());
  if (!payload) {
    doc.title = 'TuckMe · Tuck it away. Find it when it counts.';
    renderHome(doc);
  } else decodePayload(payload).then((list) => {
    if (list) {
      const one = list.single ? list.places[0] : null;
      doc.title = `${one ? one.title || siteName(one.url) || 'A save' : list.name} · TuckMe`;
      render(list, doc, { payload, isIphone });
    } else {
      renderBroken(doc, { isIphone });
    }
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePayload, safeHref, thumbSrc, imageHref, siteName, youTubeId, brandIcon, siteIcon, render, renderHome, renderBroken } from '../share.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'),
);

/** A tiny stand-in for `document`: enough to see what render() builds. */
function fakeDocument() {
  const created = [];
  const make = (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      attributes: {},
      textContent: '',
      className: '',
      append(...kids) { this.children.push(...kids); },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      set innerHTML(_) { throw new Error('innerHTML must never be used'); },
    };
    created.push(el);
    return el;
  };
  const root = make('main');
  return {
    created,
    root,
    createElement: make,
    getElementById: () => root,
  };
}

test('decodes the app fixture to the same list', async () => {
  const list = await decodePayload(fixture.payload);
  assert.equal(list.name, fixture.list.name);
  assert.equal(list.colorIndex, fixture.list.colorIndex);
  assert.equal(list.places.length, fixture.list.places.length);
  fixture.list.places.forEach((want, i) => {
    const got = list.places[i];
    assert.equal(got.title, want.title);
    assert.equal(got.url, want.url);
    assert.equal(got.address, want.address);
    assert.equal(got.lat, want.lat);
    assert.equal(got.lng, want.lng);
    assert.deepEqual(got.userTags, want.userTags);
  });
});

test('broken payloads give null', async () => {
  for (const bad of ['', 'abc', '***', fixture.payload.slice(0, 20)]) {
    assert.equal(await decodePayload(bad), null, bad);
  }
});

test('only http(s) links are linked', () => {
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('data:text/html,hi'), null);
  assert.equal(safeHref('https://a.com'), 'https://a.com');
  assert.equal(safeHref('http://a.com/x?y=1'), 'http://a.com/x?y=1');
  assert.equal(safeHref('not a url'), null);
});

test('titles with HTML are shown as text', () => {
  const doc = fakeDocument();
  render(
    {
      name: '<script>x</script>',
      colorIndex: 0,
      places: [
        { title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)', address: '' },
        { title: 'Ramen', url: 'https://a.com/r', address: '' },
      ],
    },
    doc,
    { payload: 'p', isIphone: false },
  );
  const tags = doc.created.map((e) => e.tagName);
  assert.ok(!tags.includes('SCRIPT'));
  // The only pictures are the page's own: a.com's icon, never the title's.
  const srcs = doc.created.filter((e) => e.tagName === 'IMG').map((e) => e.attributes.src);
  assert.deepEqual(srcs, ['https://a.com/favicon.ico']);
  const texts = doc.created.map((e) => e.textContent);
  assert.ok(texts.includes('<img src=x onerror=alert(1)>'));
  const hrefs = doc.created.map((e) => e.attributes.href).filter(Boolean);
  assert.ok(!hrefs.some((h) => h.startsWith('javascript:')));
  assert.ok(hrefs.includes('https://a.com/r'));
});

/** True if any element links to the app's download (GitHub releases or the APK). */
const linksToApp = (doc) => doc.created.some((e) => /github\.com|\.apk/.test(e.attributes.href || ''));

test('a shared list: Open in TuckMe, and TuckMe is coming soon (no download link yet)', () => {
  const list = { name: 'Date night', colorIndex: 8, places: [{ title: 'A', url: 'https://a.com', address: '' }] };
  for (const isIphone of [false, true]) {
    const doc = fakeDocument();
    render(list, doc, { payload: 'PAY', isIphone });
    const texts = doc.created.map((e) => e.textContent);
    assert.ok(doc.created.some((e) => e.attributes.href === 'tuck://share#PAY'));
    assert.ok(texts.includes('1 place shared with you'));
    for (const t of ['TuckMe', 'Open in TuckMe', 'Keep these in TuckMe', 'TuckMe is coming soon']) {
      assert.ok(texts.includes(t), t);
    }
    assert.ok(!linksToApp(doc));
  }
});

test('a payload that inflates past 256 KB is refused', async () => {
  const json = JSON.stringify({ v: 1, n: 'x', p: [{ t: 'a'.repeat(3000000), u: 'https://a.com' }] });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const bomb = Buffer.from(bytes).toString('base64url');
  assert.ok(bomb.length < 16000);
  assert.equal(await decodePayload(bomb), null);
});

test('a payload longer than any real link is refused unread', async () => {
  assert.equal(await decodePayload('A'.repeat(16001)), null);
});

test('with no list in the link, the page says TuckMe is coming soon, not an error', () => {
  for (const isIphone of [false, true]) {
    const doc = fakeDocument();
    renderHome(doc, { isIphone });
    const texts = doc.created.map((e) => e.textContent);
    assert.ok(!texts.some((t) => t.includes("couldn't be opened")));
    for (const t of ['Tuck it away.', 'Find it when it counts.', 'Coming soon']) {
      assert.ok(texts.includes(t), t);
    }
    assert.ok(!linksToApp(doc));
  }
});

test('a broken link offers no download either', () => {
  const doc = fakeDocument();
  renderBroken(doc, { isIphone: false });
  assert.ok(!linksToApp(doc));
});

const single = JSON.parse(
  readFileSync(new URL('./fixture_single.json', import.meta.url), 'utf8'),
);

test('one save shared on its own: the page leads with the save', async () => {
  const list = await decodePayload(single.payload);
  assert.equal(list.single, true);
  assert.equal(list.places.length, 1);
  const doc = fakeDocument();
  render(list, doc, { payload: single.payload, isIphone: true });
  const texts = doc.created.map((e) => e.textContent);
  for (const t of [single.title, 'Shared with you from TuckMe', 'Keep it in TuckMe', 'Open in TuckMe']) {
    assert.ok(texts.includes(t), t);
  }
  assert.ok(!texts.includes('Shared'), 'not the collection name it lands in');
  assert.equal(list.places[0].thumb, single.thumb);
  const srcs = doc.created.filter((e) => e.tagName === 'IMG').map((e) => e.attributes.src);
  assert.equal(srcs.length, 2);
  assert.ok(srcs[0].startsWith('data:image/svg+xml,'), 'the Instagram icon underneath');
  assert.equal(srcs[1], `data:image/jpeg;base64,${single.thumb}`);
  assert.ok(texts.includes('Open on Instagram'));
  const hrefs = doc.created.map((e) => e.attributes.href).filter(Boolean);
  assert.ok(hrefs.includes(single.url));
  assert.ok(hrefs.includes(`tuck://share#${single.payload}`));
  assert.ok(!linksToApp(doc));
});

test("a collection's pocket carries no number: the count is in words beside it", () => {
  const doc = fakeDocument();
  render({ name: 'x', colorIndex: 0, places: [{ title: 'a', url: 'https://a.com', address: '' }, { title: 'b', url: 'https://b.com', address: '' }] }, doc, { payload: 'p' });
  assert.ok(!doc.created.some((e) => e.className === 'pocket-label'));
  assert.ok(doc.created.some((e) => e.textContent === '2 places shared with you'));
});

test('a shared category is not read as one save', async () => {
  assert.equal((await decodePayload(fixture.payload)).single, false);
});

test('only plain base64 becomes a picture', () => {
  assert.equal(thumbSrc('/9j/4AA='), 'data:image/jpeg;base64,/9j/4AA=');
  for (const bad of ['', null, '"><script>', 'javascript:x', 'a b', 'A'.repeat(8001)]) {
    assert.equal(thumbSrc(bad), null, String(bad).slice(0, 20));
  }
});

test('a save with no picture shows the app it came from, over its letter', () => {
  const doc = fakeDocument();
  render({ name: 'x', colorIndex: 0, places: [{ title: 'Ramen', url: 'https://maps.app.goo.gl/x', address: '' }] }, doc, { payload: 'p' });
  const tile = doc.created.find((e) => e.className === 'row-pic tile');
  assert.equal(tile.children[0].textContent, 'G', 'the letter stays underneath');
  assert.equal(tile.children[1].attributes.src, brandIcon('https://maps.app.goo.gl/x'));
  assert.equal(tile.children.length, 2);
});

test('the common apps have their icons drawn in; other sites use their own', () => {
  for (const url of [
    'https://www.instagram.com/reel/a/',
    'https://youtu.be/a',
    'https://www.tiktok.com/@x/video/1',
    'https://maps.app.goo.gl/a',
    'https://maps.apple.com/?q=x',
    'https://pin.it/a',
    'https://www.facebook.com/x',
    'https://x.com/a/status/1',
    'https://amzn.in/d/1',
    'https://www.amazon.co.uk/dp/1',
  ]) {
    assert.ok(brandIcon(url)?.startsWith('data:image/svg+xml,'), url);
  }
  assert.equal(brandIcon('https://sugarbloom.com/menu'), null);
  assert.equal(brandIcon('https://notinstagram.com/x'), null);
  assert.equal(siteIcon('https://www.airbnb.co.in/rooms/1?x=1'), 'https://www.airbnb.co.in/favicon.ico');
  assert.equal(siteIcon('http://a.com/x'), 'https://a.com/favicon.ico');
  assert.equal(siteIcon('javascript:alert(1)'), null);
  const doc = fakeDocument();
  render({ name: 'x', colorIndex: 0, places: [{ title: 'Stay', url: 'https://www.airbnb.co.in/rooms/1', address: '' }] }, doc, { payload: 'p' });
  const icon = doc.created.find((e) => e.className === 'tile-icon');
  assert.equal(icon.attributes.src, 'https://www.airbnb.co.in/favicon.ico');
  assert.equal(icon.attributes.referrerpolicy, 'no-referrer');
});

test('sites are named the way people say them', () => {
  assert.equal(siteName('https://www.instagram.com/reel/a/'), 'Instagram');
  assert.equal(siteName('https://youtu.be/a'), 'YouTube');
  assert.equal(siteName('https://maps.app.goo.gl/a'), 'Google Maps');
  assert.equal(siteName('https://www.google.com/maps/place/x'), 'Google Maps');
  assert.equal(siteName('https://www.google.com/search?q=x'), 'google.com');
  assert.equal(siteName('https://sugarbloom.com/menu'), 'sugarbloom.com');
});

test('a YouTube video shows its own picture, over the tile', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1',
    'https://youtu.be/dQw4w9WgXcQ?si=x',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  ]) {
    assert.equal(youTubeId(url), 'dQw4w9WgXcQ', url);
  }
  for (const url of ['https://www.youtube.com/@channel', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/<b>', 'nope']) {
    assert.equal(youTubeId(url), null, url);
  }
  const doc = fakeDocument();
  render({ name: 'x', colorIndex: 0, places: [{ title: 'Dosa', url: 'https://youtu.be/dQw4w9WgXcQ', address: '' }] }, doc, { payload: 'p' });
  const imgs = doc.created.filter((e) => e.tagName === 'IMG');
  assert.equal(imgs.at(-1).attributes.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  assert.ok(doc.created.some((e) => e.textContent === 'Y'), 'the tile stays underneath');
});

test('pictures are layered: tile, app icon, then the carried picture, then the web one on top', () => {
  const doc = fakeDocument();
  render({ name: 'x', colorIndex: 0, places: [{ title: 'Lamp', url: 'https://amzn.in/d/1', address: '', thumb: '/9j/4AA=', image: 'https://m.media-amazon.com/images/I/61a.jpg' }] }, doc, { payload: 'p' });
  const tile = doc.created.find((e) => e.className === 'row-pic tile');
  assert.deepEqual(
    tile.children.map((c) => c.attributes.src || c.textContent),
    ['A', brandIcon('https://amzn.in/d/1'), 'data:image/jpeg;base64,/9j/4AA=', 'https://m.media-amazon.com/images/I/61a.jpg'],
  );
});

test('a picture address is used only if it is https', () => {
  assert.equal(imageHref('https://m.media-amazon.com/images/I/61a.jpg'), 'https://m.media-amazon.com/images/I/61a.jpg');
  for (const bad of ['http://a.com/x.jpg', 'javascript:alert(1)', 'data:image/png;base64,AA', '', null, `https://a.com/${'x'.repeat(400)}`]) {
    assert.equal(imageHref(bad), null, String(bad).slice(0, 24));
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePayload, safeHref, render, renderHome, renderBroken } from '../share.js';

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
  assert.ok(!tags.includes('IMG'));
  assert.ok(!tags.includes('SCRIPT'));
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

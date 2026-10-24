# tuck-share

The page that opens when someone shares a category from the **Tuck** app
(save links from any app, find them when it counts).

- A shared link looks like `https://ganeshpaib.github.io/tuck-share/#<list>`.
  The whole list lives in the link after `#`. Browsers never send that part to
  any server, so GitHub never sees what was shared. This repo stores no saves.
- **Open in Tuck** opens `tuck://share#<list>` in the app, where the places can
  be kept. **Get Tuck** points to this repo's
  [Releases](https://github.com/ganeshpaib/tuck-share/releases) (Android).
- Plain HTML, CSS and JavaScript; no build step, no tracking.

Tests (Node 18+): `npm test`. They decode a link made by the app's own encoder
(`test/fixture.json`) and check that shared text is never turned into markup.

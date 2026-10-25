# tuck-share

The page that opens when someone shares a category from the **TuckMe** app
(save links from any app, find them when it counts).

- A shared link looks like `https://ganeshpaib.github.io/tuck-share/#<list>`.
  The whole list lives in the link after `#`. Browsers never send that part to
  any server, so GitHub never sees what was shared. This repo stores no saves.
- **Open in TuckMe** opens `tuck://share#<list>` in the app, where the places can
  be kept. **Get TuckMe** points to this repo's
  [Releases](https://github.com/ganeshpaib/tuck-share/releases) (Android).
- With nothing after `#`, tuckme.app shows a "Coming soon" holding page: the
  icon's T tucks into its pocket and peeks out now and then, under the tagline.
  The app isn't out yet, so no page links to a download; shared lists say
  "TuckMe is coming soon" next to **Open in TuckMe**. The full landing page is
  being built on the `landing` branch.
- Plain HTML, CSS and JavaScript; no build step, no tracking.

Tests (Node 18+): `npm test`. They decode a link made by the app's own encoder
(`test/fixture.json`) and check that shared text is never turned into markup.

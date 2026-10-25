# tuck-share

The site at **https://tuckme.app** for the **TuckMe** app (save links from any
app, find them when it counts). One page, two views:

- **No `#` in the link: the landing page.** It shows what TuckMe does, with an
  animated phone tucked into the icon's pockets, plus a direct Android download.
  `landing.css` and `landing.js` hold its styles and the scene loop. The scene
  loop pauses off-screen and stays still for reduced motion. The download is
  `releases/latest/download/TuckMe.apk`, so every release must also carry an
  asset named exactly `TuckMe.apk`. iPhones see "coming soon" instead.
- **A list after `#`: the shared list.** A shared link looks like
  `https://tuckme.app/#<list>`. The whole list lives in the link after `#`.
  Browsers never send that part to any server, so no server ever sees what was
  shared. This repo stores no saves. **Open in TuckMe** opens
  `tuck://share#<list>` in the app. **Get TuckMe** goes to the landing page.
  Old `ganeshpaib.github.io/tuck-share/#…` links redirect here.
- Plain HTML, CSS and JavaScript. There's no build step and no tracking.

Tests (Node 18+): `npm test`. They decode a link made by the app's own encoder
(`test/fixture.json`), check that shared text is never turned into markup, and
check which view a link opens.

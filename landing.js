// The landing page's moving parts: the phone that plays through what TuckMe
// does, the install buttons for this visitor's phone, and the note after a tap
// on Download. A shared list never runs any of it.
(function () {
  if (document.documentElement.classList.contains('is-share')) return;

  var root = document.getElementById('landing');
  var scenes = root.querySelectorAll('.stage .scene');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP_MS = 4600;
  var current = -1;
  var timer = null;
  var visible = true;

  function show(i) {
    current = i;
    scenes.forEach(function (s, n) {
      // Off and on again in one frame would not restart the scene's animations.
      s.classList.remove('on');
    });
    void root.offsetWidth;
    scenes[i].classList.add('on');
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (still || !visible || document.hidden) return;
    timer = setTimeout(function () { show((current + 1) % scenes.length); }, STEP_MS);
  }

  function pause() {
    clearTimeout(timer);
    root.classList.add('paused');
  }

  function resume() {
    root.classList.remove('paused');
    // Start the current scene over rather than mid-way.
    show(current < 0 ? 0 : current);
  }

  if (still) {
    root.classList.add('still');
    show(0);
  } else {
    // Begin once the phone has dropped into its pocket.
    setTimeout(function () { if (current < 0) show(0); }, 1250);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (current < 0) return;
        if (visible) resume(); else pause();
      }, { threshold: 0.25 }).observe(root.querySelector('.phone'));
    }
    document.addEventListener('visibilitychange', function () {
      if (current < 0) return;
      if (document.hidden) pause(); else if (visible) resume();
    });
  }

  // How it works: each row comes in as it scrolls into view, and its phone
  // plays that step once.
  var rows = root.querySelectorAll('.how-row');
  function reveal(row) {
    row.classList.add('seen');
    row.querySelector('.scene').classList.add('on');
  }
  if (still || !('IntersectionObserver' in window)) {
    rows.forEach(reveal);
  } else {
    root.classList.add('js-reveal');
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { reveal(e.target); watch.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    rows.forEach(function (r) { watch.observe(r); });
  }

  // Ways to find it again: each chip shows its panel, its words and its screen.
  // While the section is on screen the chips take turns by themselves, until
  // the visitor picks one: from then on it stays on their choice.
  var kinds = root.querySelector('.kinds');
  var strip = root.querySelector('.kinds-tabs');
  var tabs = Array.prototype.slice.call(strip.querySelectorAll('[role="tab"]'));
  var panel = root.querySelector('.kinds-panel');
  var KIND_MS = 4200;
  var kindTimer = null;
  var kindsVisible = false;
  var picked = still;
  function kindIndex() {
    return tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
  }
  function nextKind() {
    clearTimeout(kindTimer);
    if (picked || !kindsVisible || document.hidden) return;
    kindTimer = setTimeout(function () {
      choose(tabs[(kindIndex() + 1) % tabs.length], false);
      nextKind();
    }, KIND_MS);
  }
  function stopKinds() {
    picked = true;
    clearTimeout(kindTimer);
    kinds.classList.remove('auto');
  }
  function choose(tab, focus) {
    var k = tab.getAttribute('data-k');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    panel.setAttribute('data-k', k);
    // Off and on again, so the screen and the chip's timer start over.
    panel.querySelectorAll('.ks').forEach(function (s) { s.classList.remove('on'); });
    strip.classList.remove('ticking');
    void panel.offsetWidth;
    panel.querySelector('.ks[data-k="' + k + '"]').classList.add('on');
    strip.classList.add('ticking');
    // Keep the chosen chip in view inside its row, without scrolling the page.
    var left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - 16, behavior: still ? 'auto' : 'smooth' });
    }
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, n) {
    t.addEventListener('click', function () { stopKinds(); choose(t, false); });
    t.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' ? n + 1 : e.key === 'ArrowLeft' ? n - 1 : null;
      if (to === null) return;
      e.preventDefault();
      stopKinds();
      choose(tabs[(to + tabs.length) % tabs.length], true);
    });
  });
  if (!picked && 'IntersectionObserver' in window) {
    kinds.classList.add('auto');
    new IntersectionObserver(function (entries) {
      kindsVisible = entries[0].isIntersecting;
      if (kindsVisible && !picked) {
        // Start the shown chip's timer from the beginning as it comes into view.
        choose(tabs[kindIndex()], false);
        nextKind();
      } else {
        clearTimeout(kindTimer);
      }
    }, { threshold: 0.4 }).observe(panel);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && kindsVisible && !picked) { choose(tabs[kindIndex()], false); nextKind(); }
      else clearTimeout(kindTimer);
    });
  }

  // Install buttons for the phone in the visitor's hand.
  var ua = navigator.userAgent;
  var isIphone = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var aside = root.querySelector('[data-aside]');

  if (isIphone) {
    root.querySelectorAll('[data-download]').forEach(function (a) {
      var soon = document.createElement('span');
      soon.className = a.className.replace('btn-ink', 'btn-soon');
      soon.textContent = 'Coming soon to iPhone';
      a.replaceWith(soon);
    });
    root.querySelector('[data-hero-note]').textContent =
      'TuckMe is on Android today. The iPhone version is on its way.';
    root.querySelector('#get-h').textContent = 'TuckMe for iPhone is coming soon';
    root.querySelector('.install').hidden = true;
    root.querySelector('.get-phone').hidden = true;
    root.querySelector('.get-cta .fine').textContent = '';
    aside.textContent = 'Friends can already share TuckMe lists with you: their links open right here in Safari.';
    aside.hidden = false;
  } else if (!isAndroid) {
    aside.textContent = 'On a computer? Open tuckme.app on your Android phone and install it there.';
    aside.hidden = false;
  }

  // After a tap on Download (on Android): say what to do once the file arrives.
  if (isAndroid) {
    var toast = document.createElement('div');
    toast.className = 'dl-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    var hide = null;
    root.querySelectorAll('[data-download]').forEach(function (a) {
      a.addEventListener('click', function () {
        toast.textContent = '';
        var b = document.createElement('b');
        b.textContent = 'Downloading TuckMe. ';
        toast.append(b, 'When it finishes, open the file and tap Install.');
        toast.classList.add('show');
        clearTimeout(hide);
        hide = setTimeout(function () { toast.classList.remove('show'); }, 7000);
      });
    });
  }
})();

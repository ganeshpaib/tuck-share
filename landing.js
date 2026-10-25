// The landing page's moving parts: the phone that plays through what TuckMe
// does, the install buttons for this visitor's phone, and the note after a tap
// on Download. A shared list never runs any of it.
(function () {
  if (document.documentElement.classList.contains('is-share')) return;

  var root = document.getElementById('landing');
  var scenes = root.querySelectorAll('.scene');
  var steps = root.querySelectorAll('.steps li');
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
    steps.forEach(function (li, n) {
      li.classList.remove('on');
      li.classList.toggle('done', n < i);
      li.querySelector('button').setAttribute('aria-pressed', String(n === i));
    });
    void root.offsetWidth;
    scenes[i].classList.add('on');
    steps[i].classList.add('on');
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
    // Start the current step over, so the bar and the phone stay in step.
    show(current < 0 ? 0 : current);
  }

  steps.forEach(function (li, n) {
    li.querySelector('button').addEventListener('click', function () { show(n); });
  });

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

  // Ways to find it again: each chip shows its panel, its words and its screen.
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.kinds-tabs [role="tab"]'));
  var panel = root.querySelector('.kinds-panel');
  function choose(tab, focus) {
    var k = tab.getAttribute('data-k');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    panel.setAttribute('data-k', k);
    panel.querySelectorAll('.ks').forEach(function (s) {
      s.classList.toggle('on', s.getAttribute('data-k') === k);
    });
    if (focus) {
      tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  tabs.forEach(function (t, n) {
    t.addEventListener('click', function () { choose(t, false); });
    t.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' ? n + 1 : e.key === 'ArrowLeft' ? n - 1 : null;
      if (to === null) return;
      e.preventDefault();
      choose(tabs[(to + tabs.length) % tabs.length], true);
    });
  });

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

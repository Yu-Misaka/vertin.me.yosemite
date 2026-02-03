(function () {
  'use strict';

  const EXIT_CLASSES = ['ps-list-exit', 'ps-post-exit', 'ps-page-exit'];
  const ENTER_CLASSES = ['ps-list-enter', 'ps-post-enter', 'ps-page-enter'];
  const PRELOAD_CLASSES = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];

  function getPageType() {
    const root = document.getElementById('swup');
    return (root && root.dataset && root.dataset.psPageType) || 'list';
  }

  function toExitClass(type) {
    if (type === 'post') return 'ps-post-exit';
    if (type === 'page') return 'ps-page-exit';
    return 'ps-list-exit';
  }

  function toEnterClass(type) {
    if (type === 'post') return 'ps-post-enter';
    if (type === 'page') return 'ps-page-enter';
    return 'ps-list-enter';
  }

  function clearClasses(list) {
    const html = document.documentElement;
    list.forEach((name) => html.classList.remove(name));
  }

  function getDurationMs() {
    const css = getComputedStyle(document.documentElement);
    const raw = css.getPropertyValue('--ps-anim-duration-slow') || '320ms';
    const value = raw.trim();
    if (value.endsWith('ms')) return parseFloat(value);
    if (value.endsWith('s')) return parseFloat(value) * 1000;
    return 320;
  }

  function runEnter() {
    const html = document.documentElement;
    clearClasses(ENTER_CLASSES);
    clearClasses(PRELOAD_CLASSES);
    const cls = toEnterClass(getPageType());
    html.classList.add(cls);
    setTimeout(() => html.classList.remove(cls), getDurationMs() + 80);
  }

  function runExit() {
    const html = document.documentElement;
    clearClasses(EXIT_CLASSES);
    const cls = toExitClass(getPageType());
    html.classList.add(cls);
    html.classList.add('is-animating');
    const swup = document.getElementById('swup');
    if (swup) swup.classList.add('ps-vt-mode');
    setTimeout(() => {
      html.classList.remove(cls);
      html.classList.remove('is-animating');
      if (swup) swup.classList.remove('ps-vt-mode');
    }, getDurationMs() + 160);
  }

  document.addEventListener('DOMContentLoaded', () => {
    runEnter();
  });

  document.addEventListener('astro:before-swap', () => {
    runExit();
  });

  document.addEventListener('astro:after-swap', () => {
    runEnter();
  });

  function ensureThemeToggle() {
    if (typeof window.toggleTheme === 'function') return;
    window.toggleTheme = function () {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
        document.cookie = 'theme=' + next + '; path=/; max-age=31536000';
      } catch (e) {}
    };
  }

  document.addEventListener('DOMContentLoaded', ensureThemeToggle);
  document.addEventListener('astro:after-swap', ensureThemeToggle);

  window.__psRunEnter = runEnter;
})();

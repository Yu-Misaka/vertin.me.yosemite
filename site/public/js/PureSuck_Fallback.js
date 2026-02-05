(function () {
  'use strict';

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

  function runShortcodes() {
    if (typeof window.__psShortcodesInit === 'function') {
      window.__psShortcodesInit(document);
    }
  }

  function init() {
    ensureThemeToggle();
    runShortcodes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:page-load', init);
  document.addEventListener('astro:after-swap', init);
})();

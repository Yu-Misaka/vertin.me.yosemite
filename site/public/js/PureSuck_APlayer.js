(function () {
  'use strict';

  const PRIMARY_SRC = 'https://mirrors.sustech.edu.cn/cdnjs/ajax/libs/aplayer/1.10.1/APlayer.min.js';
  const FALLBACK_SRC = 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js';

  function loadScript(src, cb) {
    if (!src) return cb();
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.dataset.loaded === '1') return cb();
      existing.addEventListener('load', cb, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = '0';
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      cb();
    });
    script.addEventListener('error', cb);
    document.head.appendChild(script);
  }

  function init() {
    let config = window.__aplayerConfig;
    if (window.__aplayer) return;
    const container = document.getElementById('aplayer');
    if (!container) return;
    if (!config) {
      const attr = container.getAttribute('data-aplayer-config');
      if (attr) {
        try {
          config = JSON.parse(attr);
        } catch (e) {}
      }
    }
    if (!config) return;
    if (!window.__aplayerConfig) {
      window.__aplayerConfig = config;
    }

    const create = () => {
      if (!window.APlayer || window.__aplayer) return;
      window.__aplayer = new APlayer({
        container,
        theme: config.theme,
        listFolded: config.listFolded,
        listMaxHeight: config.listMaxHeight,
        audio: config.audio
      });
    };

    if (window.APlayer) {
      create();
      return;
    }

    loadScript(PRIMARY_SRC, () => {
      if (window.APlayer) return create();
      loadScript(FALLBACK_SRC, create);
    });
  }

  window.__initAPlayer = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('swup:page:view', init);
  document.addEventListener('swup:contentReplaced', init);
})();

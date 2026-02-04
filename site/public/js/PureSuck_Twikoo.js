(function () {
  'use strict';

  var TWIKOO_SRC = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js';
  var twikooLoading = null;

  function getEnvId() {
    var root = document.getElementById('comments');
    if (!root || !root.dataset) return '';
    return root.dataset.twikooEnv || '';
  }

  function ensureTwikoo() {
    if (window.twikoo) return Promise.resolve(window.twikoo);
    if (twikooLoading) return twikooLoading;

    twikooLoading = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = TWIKOO_SRC;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        resolve(window.twikoo || null);
      };
      script.onerror = function () {
        twikooLoading = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });

    return twikooLoading;
  }

  function initTwikoo() {
    var envId = getEnvId();
    var container = document.getElementById('tcomment');
    if (!envId || !container) return;

    ensureTwikoo().then(function (twikoo) {
      if (!twikoo) return;
      var path = window.location.pathname;
      if (container.dataset.twikooPath === path) return;
      container.dataset.twikooPath = path;
      twikoo.init({
        envId: envId,
        el: '#tcomment',
        path: path
      });
    });
  }

  window.__initTwikoo = initTwikoo;

  document.addEventListener('DOMContentLoaded', function () {
    initTwikoo();
  });

  document.addEventListener('astro:page-load', function () {
    initTwikoo();
  });

  document.addEventListener('astro:after-swap', function () {
    initTwikoo();
  });

  document.addEventListener('swup:contentReplaced', function () {
    initTwikoo();
  });

  document.addEventListener('swup:page:view', function () {
    initTwikoo();
  });
})();

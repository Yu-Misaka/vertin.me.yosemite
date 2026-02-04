(function () {
  'use strict';

  function getEnvId() {
    var root = document.getElementById('comments');
    if (!root || !root.dataset) return '';
    return root.dataset.twikooEnv || '';
  }

  function initTwikoo() {
    var envId = getEnvId();
    if (!envId || !window.twikoo) return;
    window.twikoo.init({
      envId: envId,
      el: '#tcomment',
      path: window.location.pathname
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

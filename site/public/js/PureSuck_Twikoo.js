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

    var path = window.location.pathname;
    
    // 如果容器已经初始化过相同路径的评论，跳过
    if (container.dataset.twikooPath === path && container.children.length > 0) {
      return;
    }
    
    // 清空容器并标记路径
    container.innerHTML = '';
    container.dataset.twikooPath = path;

    ensureTwikoo().then(function (twikoo) {
      if (!twikoo) return;
      
      // 再次检查：容器是否存在、路径是否仍然匹配（避免快速导航的竞态条件）
      var currentContainer = document.getElementById('tcomment');
      var currentPath = window.location.pathname;
      if (!currentContainer || currentContainer !== container) return;
      if (currentPath !== path) return;
      
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
})();

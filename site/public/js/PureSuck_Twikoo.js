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
    
    // 清空容器并重新初始化
    container.innerHTML = '';
    container.dataset.twikooPath = path;

    ensureTwikoo().then(function (twikoo) {
      if (!twikoo) return;
      // 再次检查容器是否存在（可能在异步等待期间页面已切换）
      var currentContainer = document.getElementById('tcomment');
      if (!currentContainer || currentContainer !== container) return;
      
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

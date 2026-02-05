(function () {
  'use strict';

  var TWIKOO_SRC = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js';
  var twikooLoading = null;
  // 初始化计数器：使用模运算避免溢出（实际上用户在单个会话中不太可能导航超过1亿次）
  var initCounter = 0;
  var MAX_COUNTER = 100000000;
  // 防止重复初始化的标记
  var lastInitPath = null;
  var isInitializing = false;

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
    
    // 防止同一路径重复初始化（astro:after-swap 和 astro:page-load 可能都会触发）
    if (lastInitPath === path && !isInitializing) {
      // 如果已经初始化过且容器有内容，跳过
      if (container.children.length > 0) {
        return;
      }
    }
    
    // 如果正在初始化中，跳过
    if (isInitializing && lastInitPath === path) {
      return;
    }
    
    isInitializing = true;
    lastInitPath = path;
    
    // 每次初始化使用唯一ID，避免 Twikoo 内部状态冲突
    initCounter = (initCounter + 1) % MAX_COUNTER;
    var uniqueId = 'tcomment-' + initCounter;
    
    // 使用 DOM API 创建子容器（避免 innerHTML XSS 风险）
    container.innerHTML = '';
    var subContainer = document.createElement('div');
    subContainer.id = uniqueId;
    container.appendChild(subContainer);
    
    var thisInitCounter = initCounter;

    ensureTwikoo().then(function (twikoo) {
      isInitializing = false;
      
      if (!twikoo) return;
      
      // 验证：计数器是否仍然匹配（避免竞态条件）
      if (thisInitCounter !== initCounter) return;
      
      // 验证：路径是否仍然匹配
      var currentPath = window.location.pathname;
      if (currentPath !== path) return;
      
      // 验证：容器是否存在
      var targetEl = document.getElementById(uniqueId);
      if (!targetEl) return;
      
      twikoo.init({
        envId: envId,
        el: '#' + uniqueId,
        path: path
      });
    }).catch(function() {
      isInitializing = false;
    });
  }

  window.__initTwikoo = initTwikoo;

  document.addEventListener('DOMContentLoaded', function () {
    initTwikoo();
  });

  // 使用 astro:page-load 作为唯一的导航事件监听器
  // astro:page-load 在初始页面加载和每次导航后都会触发
  document.addEventListener('astro:page-load', function () {
    // 重置路径追踪，因为这是新页面
    lastInitPath = null;
    isInitializing = false;
    initTwikoo();
  });
})();

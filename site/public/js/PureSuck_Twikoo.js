(function () {
  'use strict';

  var TWIKOO_SRC = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js';
  // 初始化计数器：使用模运算避免溢出
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

  /**
   * 完全重新加载 Twikoo 脚本
   * 这会删除旧的脚本和 window.twikoo，然后加载新的实例
   * 确保每次导航后 Twikoo 有完全干净的状态
   */
  function reloadTwikoo() {
    return new Promise(function (resolve) {
      // 1. 删除旧的 Twikoo 脚本标签
      var oldScripts = document.querySelectorAll('script[src*="twikoo"]');
      oldScripts.forEach(function(script) {
        script.parentNode.removeChild(script);
      });
      
      // 2. 清除 window.twikoo 引用，让 Twikoo 完全重新初始化
      if (window.twikoo) {
        delete window.twikoo;
      }
      
      // 3. 加载新的 Twikoo 脚本
      var script = document.createElement('script');
      script.src = TWIKOO_SRC;
      script.async = true;
      script.onload = function () {
        resolve(window.twikoo || null);
      };
      script.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }

  function initTwikoo() {
    var envId = getEnvId();
    var container = document.getElementById('tcomment');
    if (!envId || !container) return;

    var path = window.location.pathname;
    
    // 防止同一路径重复初始化
    if (lastInitPath === path && (isInitializing || container.children.length > 0)) {
      return;
    }
    
    isInitializing = true;
    lastInitPath = path;
    
    // 每次初始化使用唯一ID
    initCounter = (initCounter + 1) % MAX_COUNTER;
    var uniqueId = 'tcomment-' + initCounter;
    
    // 清空容器并创建新的子容器
    container.innerHTML = '';
    var subContainer = document.createElement('div');
    subContainer.id = uniqueId;
    container.appendChild(subContainer);
    
    var thisInitCounter = initCounter;

    // 完全重新加载 Twikoo 以获得干净状态
    reloadTwikoo().then(function (twikoo) {
      if (!twikoo) {
        isInitializing = false;
        return;
      }
      
      // 验证：计数器是否仍然匹配（避免竞态条件）
      if (thisInitCounter !== initCounter) {
        isInitializing = false;
        return;
      }
      
      // 验证：路径是否仍然匹配
      var currentPath = window.location.pathname;
      if (currentPath !== path) {
        isInitializing = false;
        return;
      }
      
      // 验证：容器是否存在
      var targetEl = document.getElementById(uniqueId);
      if (!targetEl) {
        isInitializing = false;
        return;
      }
      
      twikoo.init({
        envId: envId,
        el: '#' + uniqueId,
        path: path
      });
      
      isInitializing = false;
    }).catch(function(error) {
      console.error('Twikoo initialization failed:', error);
      isInitializing = false;
    });
  }

  window.__initTwikoo = initTwikoo;

  // 只使用 astro:page-load，它在初始页面加载和每次导航后都会触发
  document.addEventListener('astro:page-load', function () {
    // 重置路径追踪，因为这是新页面
    lastInitPath = null;
    isInitializing = false;
    
    // 使用 requestAnimationFrame 确保 DOM 已完全渲染
    requestAnimationFrame(function() {
      initTwikoo();
    });
  });
})();

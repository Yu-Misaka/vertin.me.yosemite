/**
 * PureSuck Twikoo Integration
 * 
 * Handles both:
 * 1. Comment widget initialization on post pages
 * 2. Comment count fetching on list pages
 */
(function () {
  'use strict';

  // ==================== Shared Configuration ====================
  var TWIKOO_SRC = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js';

  // ==================== Shared Utilities ====================
  
  // Get stored envId as fallback (from sessionStorage)
  function getStoredEnvId() {
    try {
      return sessionStorage.getItem('twikooEnvId') || '';
    } catch (e) {
      return '';
    }
  }

  // Store envId for pages without the comments element
  function storeEnvId(envId) {
    if (envId) {
      try {
        sessionStorage.setItem('twikooEnvId', envId);
      } catch (e) {}
    }
  }

  function getEnvId() {
    // Try to get envId from the comments element
    var root = document.getElementById('comments');
    if (root && root.dataset && root.dataset.twikooEnv) {
      return root.dataset.twikooEnv;
    }
    // Fallback: look for the twikoo envId attribute on the html element
    var htmlEl = document.documentElement;
    if (htmlEl.dataset && htmlEl.dataset.twikooEnv) {
      return htmlEl.dataset.twikooEnv;
    }
    // Final fallback: check sessionStorage
    return getStoredEnvId();
  }

  // ==================== Comment Widget (for post pages) ====================
  
  var initCounter = 0;
  var MAX_COUNTER = 100000000;
  var lastInitPath = null;
  var isInitializing = false;

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

  // ==================== Comment Count (for list pages) ====================
  
  var isLoadingCount = false;

  function getCommentElements() {
    return document.querySelectorAll('a.icon-ui.icon-ui-comment.meta-item.meta-comment');
  }

  function extractPathFromHref(href) {
    try {
      var url = new URL(href, window.location.origin);
      return url.pathname;
    } catch (e) {
      return null;
    }
  }

  function loadTwikooScript() {
    return new Promise(function(resolve) {
      if (window.twikoo) {
        resolve(window.twikoo);
        return;
      }
      
      // Check if script is already loading
      var existingScript = document.querySelector('script[src*="twikoo"]');
      if (existingScript) {
        // Wait for it to load with proper cleanup
        var resolved = false;
        var checkInterval = setInterval(function() {
          if (window.twikoo && !resolved) {
            resolved = true;
            clearInterval(checkInterval);
            resolve(window.twikoo);
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(function() {
          if (!resolved) {
            resolved = true;
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 5000);
        return;
      }
      
      // Load the script
      var script = document.createElement('script');
      script.src = TWIKOO_SRC;
      script.async = true;
      script.onload = function() {
        resolve(window.twikoo || null);
      };
      script.onerror = function() {
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }

  function formatCommentCount(count) {
    if (count === 0) {
      return ' 暂无评论';
    } else {
      return ' ' + count + ' 条评论';
    }
  }

  function updateCommentCounts() {
    var commentElements = getCommentElements();
    if (commentElements.length === 0) {
      return;
    }

    // Collect all unique URLs
    var urlMap = {}; // path -> [elements]
    var urls = [];

    commentElements.forEach(function(el) {
      var href = el.getAttribute('href');
      var path = extractPathFromHref(href);
      if (path) {
        if (!urlMap[path]) {
          urlMap[path] = [];
          urls.push(path);
        }
        urlMap[path].push(el);
      }
    });

    if (urls.length === 0) {
      return;
    }

    var envId = getEnvId();
    if (!envId) {
      return;
    }

    if (isLoadingCount) {
      return;
    }
    isLoadingCount = true;

    loadTwikooScript().then(function(twikoo) {
      if (!twikoo || typeof twikoo.getCommentsCount !== 'function') {
        isLoadingCount = false;
        return;
      }

      twikoo.getCommentsCount({
        envId: envId,
        urls: urls,
        includeReply: false
      }).then(function(res) {
        isLoadingCount = false;
        if (!Array.isArray(res)) {
          return;
        }

        res.forEach(function(item) {
          var elements = urlMap[item.url];
          if (elements) {
            var text = formatCommentCount(item.count);
            elements.forEach(function(el) {
              el.textContent = text;
            });
          }
        });
      }).catch(function(err) {
        isLoadingCount = false;
        console.error('Failed to fetch comment counts:', err);
      });
    }).catch(function() {
      isLoadingCount = false;
    });
  }

  // ==================== Initialization ====================

  var hasInitialized = false;

  function init() {
    // Prevent double initialization
    if (hasInitialized) {
      return;
    }
    hasInitialized = true;

    // Store envId for pages that might not have the comments element
    var envId = getEnvId();
    storeEnvId(envId);

    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(function() {
      // Initialize comment widget on post pages
      initTwikoo();
      // Update comment counts on list pages
      updateCommentCounts();
    });
  }

  // Export functions for external use
  window.__initTwikoo = initTwikoo;
  window.__updateCommentCounts = updateCommentCounts;

  // Run on initial load and after page transitions (astro:page-load works for both)
  document.addEventListener('astro:page-load', function () {
    // Reset state for new page navigation
    lastInitPath = null;
    isInitializing = false;
    isLoadingCount = false;
    hasInitialized = false; // Allow re-initialization on page navigation
    
    init();
  });

  // Also run on DOMContentLoaded for initial page load without Astro transitions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * PureSuck Comment Count
 * 
 * Uses Twikoo API to fetch and display comment counts on post list pages
 */
(function() {
  'use strict';

  // Use same Twikoo version as PureSuck_Twikoo.js
  var TWIKOO_SRC = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js';
  var isLoading = false;

  // Get stored envId as fallback (from sessionStorage)
  function getStoredEnvId() {
    try {
      return sessionStorage.getItem('twikooEnvId') || '';
    } catch (e) {
      return '';
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

  function getCommentElements() {
    return document.querySelectorAll('a.icon-ui.icon-ui-comment.meta-item.meta-comment');
  }

  function extractPathFromHref(href) {
    try {
      var url = new URL(href, window.location.origin);
      // Remove the hash part (#comments)
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

    if (isLoading) {
      return;
    }
    isLoading = true;

    loadTwikooScript().then(function(twikoo) {
      if (!twikoo || typeof twikoo.getCommentsCount !== 'function') {
        isLoading = false;
        return;
      }

      twikoo.getCommentsCount({
        envId: envId,
        urls: urls,
        includeReply: false
      }).then(function(res) {
        isLoading = false;
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
        isLoading = false;
        console.error('Failed to fetch comment counts:', err);
      });
    }).catch(function() {
      isLoading = false;
    });
  }

  // Store envId for pages without the comments element
  function storeEnvIdFromCommentsElement() {
    var root = document.getElementById('comments');
    if (root && root.dataset && root.dataset.twikooEnv) {
      try {
        sessionStorage.setItem('twikooEnvId', root.dataset.twikooEnv);
      } catch (e) {}
    }
  }

  function init() {
    storeEnvIdFromCommentsElement();
    // Small delay to ensure DOM is ready
    requestAnimationFrame(function() {
      updateCommentCounts();
    });
  }

  // Run on initial load and after page transitions
  document.addEventListener('astro:page-load', init);
  
  // Also run on DOMContentLoaded for initial page load without Astro transitions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for external use
  window.__updateCommentCounts = updateCommentCounts;
})();

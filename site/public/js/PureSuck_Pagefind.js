(function () {
  'use strict';

  var PAGEFIND_JS = '/pagefind/pagefind.js';
  var PLACEHOLDER_GIF =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var pagefindLoading = null;
  var searchToken = 0;

  function loadPagefind() {
    if (window.__pagefind) return Promise.resolve(window.__pagefind);
    if (pagefindLoading) return pagefindLoading;

    pagefindLoading = import(PAGEFIND_JS)
      .then(function (mod) {
        var pagefind = mod && (mod.pagefind || mod.default || mod);
        window.__pagefind = pagefind;
        return pagefind;
      })
      .catch(function () {
        pagefindLoading = null;
        return null;
      });

    return pagefindLoading;
  }

  function normalizeUrl(url) {
    if (!url) return '';
    try {
      var parsed = new URL(url, window.location.origin);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch (err) {
      return url;
    }
  }

  function getPathname(url) {
    if (!url) return '';
    try {
      return new URL(url, window.location.origin).pathname;
    } catch (err) {
      return url.split('#')[0].split('?')[0];
    }
  }

  function getSlugFromPath(pathname) {
    if (!pathname) return '';
    var trimmed = pathname.replace(/\/$/, '');
    var match = trimmed.match(/\/posts\/([^\/]+)$/);
    return match ? match[1] : trimmed;
  }

  function updateTitle(titleEl, query) {
    if (!titleEl) return;
    titleEl.textContent = query ? '包含关键字 ' + query + ' 的文章' : '搜索';
  }

  function updateMessage(messageEl, query, count, loading, error) {
    if (!messageEl) return;
    if (loading) {
      messageEl.textContent = '搜索中...';
      return;
    }
    if (error) {
      messageEl.textContent = error;
      return;
    }
    if (!query) {
      messageEl.textContent = '';
      return;
    }
    if (!count) {
      messageEl.textContent = '没有找到相关内容';
      return;
    }
    messageEl.textContent = '找到 ' + count + ' 个 ' + query + ' 的相关结果';
  }

  function setQueryParam(query) {
    var url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url.toString());
  }

  function getQueryParam() {
    var params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  }

  function createElement(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function buildPostCard(data, context) {
    var url = normalizeUrl(data.url);
    if (!url) return null;

    var pathname = getPathname(url);
    if (!pathname.startsWith('/posts/')) return null;

    var meta = data.meta || {};
    var title = meta.title || data.title || '';
    var date = meta.date || '';
    var image = meta.image || '';
    var description = meta.description || '';
    var category = meta.category || '';
    var hasImg = Boolean(image);

    var article = createElement('article');
    article.className =
      'post ' +
      (hasImg ? 'post--photo post--cover' : 'post--text') +
      ' post--index main-item ps-enter-hidden-list';
    article.setAttribute('data-ps-post-key', getSlugFromPath(pathname));
    article.setAttribute('data-protected', 'false');
    article.setAttribute('data-swup-animation', '');

    var inner = createElement('div', 'post-inner');

    if (context.showCategory && category) {
      var cat = createElement('span', 'post-cat-vertical');
      cat.textContent = category;
      inner.appendChild(cat);
    }

    var header = createElement('header', 'post-item post-header' + (hasImg ? ' no-bg' : ''));
    var headerWrapper = createElement('div', 'wrapper post-wrapper');
    var avatar = createElement('div', 'avatar post-author');
    var avatarImg = document.createElement('img');
    avatarImg.src = context.authorAvatar;
    avatarImg.alt = '作者头像';
    avatarImg.className = 'avatar-item avatar-img';
    avatarImg.loading = 'lazy';
    avatarImg.decoding = 'async';
    avatarImg.fetchPriority = 'low';
    var avatarName = createElement('span', 'avatar-item');
    avatarName.textContent = context.authorName;
    avatar.appendChild(avatarImg);
    avatar.appendChild(avatarName);
    headerWrapper.appendChild(avatar);
    header.appendChild(headerWrapper);
    inner.appendChild(header);

    if (hasImg) {
      var figure = createElement('figure', 'post-media');
      var img = document.createElement('img');
      img.setAttribute('itemprop', 'image');
      img.src = PLACEHOLDER_GIF;
      img.setAttribute('data-lazy-src', image);
      img.alt = '头图';
      img.decoding = 'async';
      img.fetchPriority = 'auto';
      figure.appendChild(img);
      inner.appendChild(figure);
    }

    var body = createElement('section', 'post-item post-body');
    var bodyWrapper = createElement('div', 'wrapper post-wrapper');
    var h1 = createElement('h1', 'post-title');
    var link = document.createElement('a');
    link.href = url;
    link.textContent = title || url;
    h1.appendChild(link);
    bodyWrapper.appendChild(h1);

    var excerpt = createElement('p', 'post-excerpt');
    if (description) {
      excerpt.textContent = description;
    } else if (data.excerpt) {
      excerpt.innerHTML = data.excerpt;
    }
    bodyWrapper.appendChild(excerpt);
    body.appendChild(bodyWrapper);
    inner.appendChild(body);

    var footer = createElement('footer', 'post-item post-footer');
    var footerWrapper = createElement('div', 'wrapper post-wrapper');
    var metaWrap = createElement('div', 'meta post-meta');
    var dateLink = document.createElement('a');
    dateLink.setAttribute('itemprop', 'datePublished');
    dateLink.href = url;
    dateLink.className = 'icon-ui icon-ui-date meta-item meta-date';
    var dateSpan = createElement('span', 'meta-count');
    dateSpan.textContent = date;
    dateLink.appendChild(dateSpan);
    var commentLink = document.createElement('a');
    commentLink.href = url.split('#')[0] + '#comments';
    commentLink.className = 'icon-ui icon-ui-comment meta-item meta-comment';
    commentLink.textContent = '暂无评论';
    metaWrap.appendChild(dateLink);
    metaWrap.appendChild(commentLink);
    footerWrapper.appendChild(metaWrap);
    footer.appendChild(footerWrapper);
    inner.appendChild(footer);

    article.appendChild(inner);
    return article;
  }

  function renderResults(resultsEl, items, context) {
    resultsEl.innerHTML = '';
    var fragment = document.createDocumentFragment();
    items.forEach(function (data) {
      var card = buildPostCard(data, context);
      if (card) fragment.appendChild(card);
    });
    resultsEl.appendChild(fragment);

    if (window.LazyLoadManager && typeof window.LazyLoadManager.observe === 'function') {
      window.LazyLoadManager.observe(resultsEl);
    }
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  function initSearchPage() {
    var searchPage = document.getElementById('search-page');
    if (!searchPage || searchPage.dataset.searchReady === '1') return;
    searchPage.dataset.searchReady = '1';

    var form = document.getElementById('search-form');
    var input = document.getElementById('search-input');
    var resultsEl = document.getElementById('search-results');
    var messageEl = document.getElementById('search-message');
    var titleEl = document.getElementById('search-title');

    if (!form || !input || !resultsEl) return;

    var context = {
      authorName: searchPage.dataset.authorName || '',
      authorAvatar: searchPage.dataset.authorAvatar || '',
      showCategory: searchPage.dataset.showCategory === '1'
    };

    var runSearch = function (query) {
      var token = ++searchToken;
      var trimmed = query.trim();
      updateTitle(titleEl, trimmed);
      setQueryParam(trimmed);

      if (!trimmed) {
        resultsEl.innerHTML = '';
        updateMessage(messageEl, trimmed, 0, false);
        return;
      }

      updateMessage(messageEl, trimmed, 0, true);

      loadPagefind().then(function (pagefind) {
        if (!pagefind || typeof pagefind.search !== 'function') {
          if (token !== searchToken) return;
          resultsEl.innerHTML = '';
          updateMessage(messageEl, trimmed, 0, false, '搜索索引尚未生成，请先运行 build');
          return;
        }

        pagefind.search(trimmed).then(function (searchResult) {
          if (token !== searchToken) return;
          if (!searchResult || !searchResult.results) {
            resultsEl.innerHTML = '';
            updateMessage(messageEl, trimmed, 0, false, '搜索索引不可用');
            return;
          }

          Promise.all(searchResult.results.map(function (result) { return result.data(); }))
            .then(function (items) {
              if (token !== searchToken) return;
              var filtered = items.filter(function (item) {
                var path = getPathname(item.url || '');
                return path.startsWith('/posts/');
              });
              renderResults(resultsEl, filtered, context);
              updateMessage(messageEl, trimmed, filtered.length, false);
            })
            .catch(function () {
              if (token !== searchToken) return;
              resultsEl.innerHTML = '';
              updateMessage(messageEl, trimmed, 0, false, '搜索失败，请稍后再试');
            });
        });
      });
    };

    var debouncedSearch = debounce(runSearch, 200);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      runSearch(input.value || '');
    });

    input.addEventListener('input', function () {
      debouncedSearch(input.value || '');
    });

    var initialQuery = getQueryParam();
    if (initialQuery) {
      input.value = initialQuery;
      runSearch(initialQuery);
    } else {
      updateTitle(titleEl, '');
    }
  }

  document.addEventListener('DOMContentLoaded', initSearchPage);
  document.addEventListener('astro:after-swap', initSearchPage);
  document.addEventListener('swup:contentReplaced', initSearchPage);
  document.addEventListener('swup:page:view', initSearchPage);
})();

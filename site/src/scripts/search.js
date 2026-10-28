import { updateCommentCounts } from './integrations.js';

  var PAGEFIND_JS = '/pagefind/pagefind.js';
  var pagefindLoading = null;
  var pagefindInstance = null;
  var searchToken = 0;

  function loadPagefind() {
    if (pagefindInstance) return Promise.resolve(pagefindInstance);
    if (pagefindLoading) return pagefindLoading;

    pagefindLoading = import(PAGEFIND_JS)
      .then(function (mod) {
        var pagefind = mod && (mod.pagefind || mod.default || mod);
        pagefindInstance = pagefind;
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
    window.history.replaceState(window.history.state, '', url.toString());
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
      ' post--index main-item';
    article.setAttribute('data-ps-post-key', getSlugFromPath(pathname));
    article.setAttribute('data-protected', 'false');

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
    avatarImg.width = 32;
    avatarImg.height = 32;
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
      img.src = image;
      img.loading = 'lazy';
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

  }

  function debounce(fn, wait, signal) {
    var timer;
    signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true });
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  export function initSearchPage(root, signal) {
    var searchPage = root.querySelector('#search-page');
    signal.addEventListener('abort', () => { searchToken++; }, { once: true });
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

    var runSearch = async function (query) {
      var token = ++searchToken;
      var trimmed = query.trim();
      updateTitle(titleEl, trimmed);
      setQueryParam(trimmed);
      const stale = () => signal.aborted || token !== searchToken;
      if (!trimmed) {
        resultsEl.replaceChildren();
        updateMessage(messageEl, trimmed, 0, false);
        return;
      }
      updateMessage(messageEl, trimmed, 0, true);
      try {
        const pagefind = await loadPagefind();
        if (stale()) return;
        if (!pagefind?.search) throw new Error('搜索索引尚未生成，请先运行 build');
        const result = await pagefind.search(trimmed);
        if (stale()) return;
        const items = await Promise.all((result.results || []).map(item => item.data()));
        if (stale()) return;
        const posts = items.filter(item => getPathname(item.url || '').startsWith('/posts/'));
        renderResults(resultsEl, posts, context);
        updateCommentCounts(resultsEl, signal);
        updateMessage(messageEl, trimmed, posts.length, false);
      } catch (error) {
        if (stale()) return;
        resultsEl.replaceChildren();
        updateMessage(messageEl, trimmed, 0, false, error.message || '搜索失败，请稍后再试');
      }
    };

    var debouncedSearch = debounce(runSearch, 200, signal);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      runSearch(input.value || '');
    }, { signal });

    input.addEventListener('input', function () {
      debouncedSearch(input.value || '');
    }, { signal });

    var initialQuery = getQueryParam();
    if (initialQuery) {
      input.value = initialQuery;
      runSearch(initialQuery);
    } else {
      updateTitle(titleEl, '');
    }
  }


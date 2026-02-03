(function () {
  'use strict';

  const PLACEHOLDER_SRC =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  let tabsInstance = 0;

  function stripLeadingBreaks(value) {
    return value.replace(/^<br\s*\/?>/i, '');
  }

  function normalizeShortcodeLineBreaks(html) {
    return html
      .replace(/\[\/(alert|window|friend-card|collapsible-panel|timeline|tabs)\](<br\s*\/?>)?/gi, '[/$1]')
      .replace(/\[\/timeline-event\](<br\s*\/?>)?/gi, '[/timeline-event]')
      .replace(/\[\/tab\](<br\s*\/?>)?/gi, '[/tab]');
  }

  function normalizeShortcodeQuotes(html) {
    const shortcodePattern =
      /\[(alert|window|friend-card|collapsible-panel|timeline|timeline-event|tabs|tab|bilibili-card|PicGrid)[^\]]*\]/gi;
    return html.replace(shortcodePattern, function (match) {
      return match
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/&quot;|&#34;|&#8220;|&#8221;/g, '"')
        .replace(/&apos;|&#39;|&#8216;|&#8217;/g, "'");
    });
  }

  function parseAlerts(html) {
    return html.replace(/\[alert type="([^"]*)"\]([\s\S]*?)\[\/alert\]/gi, function (_, type, text) {
      const map = {
        green: 'icon-ok-circle',
        blue: 'icon-info-circled',
        yellow: 'icon-attention',
        red: 'icon-cancel-circle'
      };
      const iconClass = map[type] || 'icon-info-circled';
      return (
        '<div role="alert" class="alert-box ' +
        type +
        '"><i class="' +
        iconClass +
        '"></i><p class="text-xs font-semibold">' +
        text +
        '</p></div>'
      );
    });
  }

  function parseWindows(html) {
    return html.replace(
      /\[window type="([^"]*)" title="([^"]*)"\]([\s\S]*?)\[\/window\]/gi,
      function (_, type, title, text) {
        const body = stripLeadingBreaks(text);
        return (
          '<div class="window ' +
          type +
          '"><div class="flex"><div class="window-prompt-wrap"><p class="window-prompt-heading">' +
          title +
          '</p><div class="window-prompt-prompt"><p>' +
          body +
          '</p></div></div></div></div>'
        );
      }
    );
  }

  function parseFriendCards(html) {
    return html.replace(
      /\[friend-card name="([^"]*)" ico="([^"]*)" url="([^"]*)"\]([\s\S]*?)\[\/friend-card\]/gi,
      function (_, name, ico, url, description) {
        const body = stripLeadingBreaks(description);
        return (
          '<!--friendsboard-item-->' +
          '<div class="friendsboard-item">' +
          '<div class="friends-card-header">' +
          '<a href="' +
          url +
          '" class="friendsboard-link friendsboard-link-header" target="_blank" rel="noopener noreferrer">' +
          '<span class="friends-card-username">' +
          name +
          '</span>' +
          '<span class="friends-card-dot"></span>' +
          '</a>' +
          '</div>' +
          '<div class="friends-card-body">' +
          '<div class="friends-card-text">' +
          body +
          '</div>' +
          '<div class="friends-card-avatar-container">' +
          '<a href="' +
          url +
          '" class="friendsboard-link friendsboard-link-avatar" target="_blank" rel="noopener noreferrer">' +
          '<img src="' +
          ico +
          '" alt="Avatar" class="friends-card-avatar no-zoom no-figcaption" draggable="false">' +
          '</a>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '<!--/friendsboard-item-->'
        );
      }
    );
  }

  function parseCollapsible(html) {
    return html.replace(
      /\[collapsible-panel title="([^"]*)"\]([\s\S]*?)\[\/collapsible-panel\]/gi,
      function (_, title, text) {
        const body = stripLeadingBreaks(text);
        return (
          '<div class="collapsible-panel">' +
          '<button class="collapsible-header">' +
          title +
          '<span class="icon icon-down-open"></span>' +
          '</button>' +
          '<div class="collapsible-content" style="max-height: 0; overflow: hidden;">' +
          '<div class="collapsible-details">' +
          body +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }
    );
  }

  function parseTimeline(html) {
    return html.replace(/\[timeline\]([\s\S]*?)\[\/timeline\]/gi, function (_, inner) {
      const events = inner.replace(
        /\[timeline-event date="([^"]*)" title="([^"]*)"\]([\s\S]*?)\[\/timeline-event\]/gi,
        function (match, date, title, text) {
          return (
            '<div class="timeline-item">' +
            '<div class="timeline-dot"></div>' +
            '<div class="timeline-content">' +
            '<div class="timeline-date">' +
            date +
            '</div>' +
            '<p class="timeline-title">' +
            title +
            '</p>' +
            '<p class="timeline-description">' +
            text +
            '</p>' +
            '</div>' +
            '</div>'
          );
        }
      );
      return '<div id="timeline">' + events + '</div>';
    });
  }

  function parseTabs(html) {
    return html.replace(/\[tabs\]([\s\S]*?)\[\/tabs\]/gi, function (_, inner) {
      const tabMatches = inner.match(/\[tab title="([^"]*)"\][\s\S]*?\[\/tab\]/gi);
      if (!tabMatches || !tabMatches.length) return '';

      tabsInstance += 1;
      const baseId = 'tab' + tabsInstance;
      const links = [];
      const panes = [];

      tabMatches.forEach(function (block, index) {
        const titleMatch = block.match(/\[tab title="([^"]*)"\]/i);
        const title = titleMatch ? titleMatch[1] : 'Tab';
        const content = block.replace(/\[tab title="[^"]*"\]/i, '').replace(/\[\/tab\]/i, '');
        const tabContent = stripLeadingBreaks(content);
        const tabId = baseId + '-' + (index + 1);
        const isActive = index === 0;
        links.push(
          '<div class="tab-link' +
            (isActive ? ' active' : '') +
            '" data-tab="' +
            tabId +
            '" role="tab" aria-controls="' +
            tabId +
            '" tabindex="' +
            (isActive ? '0' : '-1') +
            '">' +
            title +
            '</div>'
        );
        panes.push(
          '<div class="tab-pane' +
            (isActive ? ' active' : '') +
            '" id="' +
            tabId +
            '" role="tabpanel" aria-labelledby="' +
            tabId +
            '">' +
            tabContent +
            '</div>'
        );
      });

      return (
        '<div class="tab-container">' +
        '<div class="tab-header-wrapper">' +
        '<button class="scroll-button left" aria-label="Scroll left">&#xe80f;</button>' +
        '<div class="tab-header dir-right" role="tablist">' +
        links.join('') +
        '<div class="tab-indicator"></div>' +
        '</div>' +
        '<button class="scroll-button right" aria-label="Scroll right">&#xe80f;</button>' +
        '</div>' +
        '<div class="tab-content">' +
        panes.join('') +
        '</div>' +
        '</div>'
      );
    });
  }

  function parseBilibili(html) {
    return html.replace(/\[bilibili-card bvid="([^"]*)"\]/gi, function (_, bvid) {
      const url = '//player.bilibili.com/player.html?bvid=' + bvid + '&autoplay=0';
      return (
        '<div class="bilibili-card">' +
        '<iframe src="' +
        url +
        '" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>' +
        '</div>'
      );
    });
  }

  function parsePicGrid(html) {
    return html.replace(/\[PicGrid\]([\s\S]*?)\[\/PicGrid\]/gi, function (_, inner) {
      const cleaned = inner
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<figcaption>[\s\S]*?<\/figcaption>/gi, '')
        .replace(/<\/?p>/gi, '');
      return '<div class="pic-grid">' + cleaned + '</div>';
    });
  }

  function wrapFriendCards(root) {
    let node = root.firstElementChild;
    while (node) {
      if (node.classList && node.classList.contains('friendsboard-item')) {
        const list = document.createElement('div');
        list.className = 'friendsboard-list';
        node.parentNode.insertBefore(list, node);
        while (node && node.classList && node.classList.contains('friendsboard-item')) {
          const next = node.nextElementSibling;
          list.appendChild(node);
          node = next;
        }
        continue;
      }
      node = node.nextElementSibling;
    }
  }

  function addFigcaptions(root) {
    const images = root.querySelectorAll('img');
    images.forEach(function (img) {
      if (
        img.classList.contains('friends-card-avatar') ||
        img.classList.contains('no-figcaption')
      ) {
        return;
      }
      const alt = img.getAttribute('alt');
      if (!alt) return;
      const parentFigure = img.closest('figure');
      if (parentFigure) {
        if (!parentFigure.querySelector('figcaption')) {
          const figcaption = document.createElement('figcaption');
          figcaption.textContent = alt;
          parentFigure.appendChild(figcaption);
        }
        return;
      }
      const figure = document.createElement('figure');
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = alt;
      const parent = img.parentNode;
      parent.replaceChild(figure, img);
      figure.appendChild(img);
      figure.appendChild(figcaption);
    });
  }

  function applyLazyLoad(root) {
    const images = root.querySelectorAll('img');
    images.forEach(function (img) {
      const isExcluded =
        img.classList.contains('no-zoom') ||
        img.classList.contains('friends-card-avatar') ||
        img.id === 'no-zoom';

      if (!isExcluded && !img.hasAttribute('data-zoomable')) {
        img.setAttribute('data-zoomable', '');
      }

      if (img.hasAttribute('data-lazy-src')) return;
      if (img.getAttribute('loading') === 'eager') return;

      const src = img.getAttribute('src');
      if (src) {
        img.setAttribute('data-lazy-src', src);
        img.setAttribute('src', PLACEHOLDER_SRC);
      }
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        img.setAttribute('data-lazy-srcset', srcset);
        img.removeAttribute('srcset');
      }
    });
  }

  function processShortcodes(root) {
    let html = root.innerHTML;
    html = normalizeShortcodeQuotes(html);
    html = normalizeShortcodeLineBreaks(html);
    html = parseAlerts(html);
    html = parseWindows(html);
    html = parseFriendCards(html);
    html = parseCollapsible(html);
    html = parseTimeline(html);
    html = parseTabs(html);
    html = parseBilibili(html);
    html = parsePicGrid(html);

    if (html !== root.innerHTML) {
      root.innerHTML = html;
    }

    wrapFriendCards(root);
    addFigcaptions(root);
    applyLazyLoad(root);
  }

  function processAll(scope) {
    const roots = scope.querySelectorAll('.post-content');
    roots.forEach(processShortcodes);
  }

  function initialize(scope) {
    processAll(scope);

    if (typeof runShortcodes === 'function') {
      runShortcodes(scope);
    }

    if (window.LazyLoadManager && typeof window.LazyLoadManager.observe === 'function') {
      window.LazyLoadManager.observe(scope);
    }

    if (typeof renderLatex === 'function') {
      renderLatex();
    }

    if (typeof initializeStickyTOC === 'function') {
      initializeStickyTOC();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initialize(document);
  });

  document.addEventListener('astro:after-swap', function () {
    initialize(document);
  });

  document.addEventListener('swup:contentReplaced', function () {
    initialize(document);
  });

  document.addEventListener('swup:page:view', function () {
    initialize(document);
  });

  window.__psShortcodesInit = initialize;
})();

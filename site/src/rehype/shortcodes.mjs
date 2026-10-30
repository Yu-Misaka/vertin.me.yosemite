// Compatibility compiler for the existing Markdown shortcode syntax.
// Runs during the build, so visitors receive the final HTML without a parser.
export function compileShortcodes(source) {
  let tabsInstance = 0;
  function stripLeadingBreaks(value) {
    return value.replace(/^<br\s*\/?>/i, '');
  }

  function trimEmptyParagraphs(value) {
    return value
      .replace(/^(?:\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+/i, '')
      .replace(/(?:\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/i, '');
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
          '<div class="collapsible-content">' +
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
          // An opening paragraph that is entirely italic is the event's role line.
          const body = trimEmptyParagraphs(stripLeadingBreaks(text))
            .replace(/^((?:\s|<\/p>)*)<p>(<em>(?:(?!<\/?em\b|<\/p>)[\s\S])*<\/em>)<\/p>/i, '$1<p class="timeline-subtitle">$2</p>');
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
            '<div class="timeline-description">' +
            body +
            '</div>' +
            '</div>' +
            '</div>'
          );
        }
      );
      return '<div class="timeline">' + events + '</div>';
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
          '<button type="button" class="tab-link' +
            (isActive ? ' active' : '') +
            '" id="' + tabId + '-tab" aria-selected="' + isActive + '" data-tab="' +
            tabId +
            '" role="tab" aria-controls="' +
            tabId +
            '" tabindex="' +
            (isActive ? '0' : '-1') +
            '">' +
            title +
            '</button>'
        );
        panes.push(
          '<div class="tab-pane' +
            (isActive ? ' active' : '') +
            '" id="' +
            tabId +
            '" role="tabpanel" aria-labelledby="' +
            tabId + '-tab' +
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
        '<iframe loading="lazy" title="哔哩哔哩视频" src="' +
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


  const protectedBlocks = [];
  let html = source.replace(/<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, block => {
    const index = protectedBlocks.push(block) - 1;
    return `<!--ps-protected-${index}-->`;
  });
  html = normalizeShortcodeLineBreaks(normalizeShortcodeQuotes(html));
  // Markdown wraps standalone delimiters in paragraphs. Remove those wrappers
  // before inserting block elements, rather than relying on browser repairs.
  html = html.replace(/<p>(\s*\[(?:\/?(?:tabs|tab|timeline|timeline-event|collapsible-panel|window|alert|PicGrid|friend-card)|bilibili-card)\b[^\]]*\])/gi, '$1');
  html = html.replace(/(\[\/(?:tabs|tab|timeline|timeline-event|collapsible-panel|window|alert|PicGrid|friend-card)\]\s*)<\/p>/gi, '$1');
  for (const parse of [parseAlerts, parseWindows, parseFriendCards, parseCollapsible, parseTimeline, parseTabs, parseBilibili, parsePicGrid]) html = parse(html);
  return html.replace(/<!--ps-protected-(\d+)-->/g, (_, index) => protectedBlocks[Number(index)]);
}

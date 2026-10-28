import { enterPage, setupTransitions } from './animations.js';
import { setupTheme, syncTheme } from './theme.js';
import { initNavigation } from './navigation.js';
import { initToc, initGoTop } from './toc.js';
import { initWidgets } from './widgets.js';
import { initComments, initImages, initPlayer, onIdle } from './integrations.js';

const app = new AbortController();
let page;
let currentRoot;
let firstLoad = true;

setupTheme(app.signal);
setupTransitions(app.signal);

function initPage() {
  const root = document.getElementById('page-content');
  if (!root || (root === currentRoot && !page?.signal.aborted)) return;
  page?.abort();
  currentRoot = root;
  page = new AbortController();
  const { signal } = page;
  syncTheme();
  initNavigation(signal);
  initWidgets(root, signal);
  initToc(root, signal);
  initGoTop(signal);
  initComments(root, signal);
  initImages(root, signal).catch(error => console.warn('图片缩放暂时不可用', error));
  onIdle(() => initPlayer(signal), signal);
  onIdle(() => import('./notifications.js').then(({ greet }) => {
    if (!signal.aborted) greet(signal);
  }), signal);
  if (root.querySelector('#search-page')) {
    import('./search.js').then(({ initSearchPage }) => {
      if (!signal.aborted) initSearchPage(root, signal);
    }).catch(error => console.warn('搜索暂时不可用', error));
  }
  if (firstLoad) {
    const cancel = enterPage(root);
    signal.addEventListener('abort', cancel, { once: true });
    firstLoad = false;
  }
}

// Each swapped document is initialized once. Individual modules own no router
// hooks and release their observers, listeners and pending work on page abort.
document.addEventListener('astro:before-swap', () => page?.abort(), { signal: app.signal });
document.addEventListener('astro:page-load', initPage, { signal: app.signal });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage, { once: true });
else initPage();

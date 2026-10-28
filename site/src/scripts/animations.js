// Astro owns navigation and scroll restoration. Local effects never animate the
// live article while the browser is taking navigation snapshots.
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function motionDuration(token, fallback) {
  const value = typeof getComputedStyle === 'function'
    ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : '';
  return value ? parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) : fallback;
}

export const motionEasing = () => typeof getComputedStyle === 'function'
  ? getComputedStyle(document.documentElement).getPropertyValue('--motion-ease').trim() || 'ease-out'
  : 'ease-out';

export function reveal(element, { duration = motionDuration('--motion-local', 180), delay = 0, distance = 4 } = {}) {
  if (prefersReducedMotion() || !element?.animate) return () => {};
  const effect = element.animate([
    { opacity: 0, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'none' },
  ], { duration, delay, easing: motionEasing(), fill: 'backwards' });
  effect.finished.then(() => effect.cancel(), () => {});
  return () => effect.cancel();
}

export function enterPage(root, reducedMotion = prefersReducedMotion()) {
  if (reducedMotion) return () => {};
  const visible = [...root.querySelectorAll('.main > .wrapper > .post, .archive-title')]
    .filter(el => isVisible(el)).slice(0, 3);
  const cleanups = visible.map((el, index) => reveal(el, {
    duration: motionDuration('--motion-enter', 280), delay: index * 35, distance: 8,
  }));
  return () => cleanups.forEach(cancel => cancel());
}

export function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
    && rect.right > 0 && rect.left < innerWidth;
}

const normalize = path => path.replace(/\/$/, '') || '/';
const listPage = path => {
  const match = normalize(path).match(/^(.*)\/page\/(\d+)$/);
  return match ? { base: match[1] || '/', page: Number(match[2]) }
    : { base: normalize(path), page: 1 };
};

// Keep direction semantic: unrelated navigation never slides across the page.
export function navigationMotion(from, to) {
  if (to.hash || normalize(from.pathname) === normalize(to.pathname)) return 'fade';
  const a = listPage(from.pathname);
  const b = listPage(to.pathname);
  return a.base === b.base && a.page !== b.page
    ? (b.page > a.page ? 'next' : 'previous') : 'page';
}

export function setupTransitions(signal) {
  let shared;
  let generation = 0;
  let transition;
  let outgoing = [];
  const clearCovers = (root = document) => root.querySelectorAll('[data-shared-cover]').forEach(cover => {
    cover.style.viewTransitionName = '';
    cover.removeAttribute('data-astro-transition-persist');
    delete cover.dataset.sharedCover;
  });
  const clear = () => {
    clearCovers();
    delete document.documentElement.dataset.motion;
    delete document.documentElement.dataset.motionCover;
    shared = null;
    for (const { name } of outgoing) {
      for (const part of ['x', 'y', 'width']) document.documentElement.style.removeProperty(`--motion-${name}-old-${part}`);
    }
    outgoing = [];
  };
  const mark = cover => {
    cover.style.viewTransitionName = 'post-cover';
    // Reuse the already decoded image during Astro's swap. A fresh image parsed
    // in its inert destination document is not complete in the after-swap hook.
    cover.setAttribute('data-astro-transition-persist', 'shared-post-cover');
    cover.dataset.sharedCover = '';
  };
  const stop = () => transition?.skipTransition();
  // A theme change must not replay a snapshot of the previous palette.
  document.addEventListener('site:theme-change', () => { stop(); clear(); }, { signal });
  document.addEventListener('astro:before-preparation', event => {
    const currentGeneration = ++generation;
    stop();
    clear();
    document.dispatchEvent(new Event('site:before-navigation'));
    if (prefersReducedMotion() || !document.startViewTransition) return;
    document.documentElement.dataset.motion = navigationMotion(event.from, event.to);
    if (!event.to.hash) {
      const key = normalize(event.to.pathname).match(/^\/posts\/([^/]+)$/)?.[1];
      const cards = [...document.querySelectorAll('.post[data-ps-post-key]')];
      const source = event.sourceElement?.closest('.post[data-ps-post-key]')
        || cards.find(card => card.classList.contains('post--single'))
        || (event.navigationType === 'traverse' ? cards.find(card => card.dataset.psPostKey === key) : null);
      const fromPost = Boolean(source?.classList.contains('post--single'));
      const cover = source?.querySelector('.post-media');
      const img = cover?.querySelector('img');
      if (source && (fromPost || source.dataset.psPostKey === key)
        && isVisible(cover) && img?.complete && img.naturalWidth) {
        shared = { key: source.dataset.psPostKey, fromPost, src: img.getAttribute('src') };
        mark(cover);
      }
    }
    event.signal.addEventListener('abort', () => {
      if (currentGeneration === generation) { stop(); clear(); }
    }, { once: true });
  }, { signal });
  document.addEventListener('astro:after-preparation', () => {
    if (!document.documentElement.dataset.motion) return;
    outgoing = [['content', '.main'], ['toc', '#toc-section']].flatMap(([name, selector]) => {
      const element = document.querySelector(selector);
      return element ? [{ name, selector, rect: element.getBoundingClientRect() }] : [];
    });
    const cover = document.querySelector('[data-shared-cover]');
    // The reader may have scrolled while the next document was loading.
    if (shared && !isVisible(cover)) { clearCovers(); shared = null; }
  }, { signal });
  document.addEventListener('astro:before-swap', event => {
    const currentGeneration = generation;
    transition = event.viewTransition;
    const html = event.newDocument.documentElement;
    html.dataset.theme = document.documentElement.dataset.theme;
    html.dataset.motion = document.documentElement.dataset.motion || 'fade';
    event.viewTransition.finished.finally(() => {
      if (currentGeneration === generation) { transition = null; clear(); }
    }).catch(() => {});
    if (prefersReducedMotion()) { stop(); clear(); return; }
    if (shared) {
      const target = [...event.newDocument.querySelectorAll('.post[data-ps-post-key]')]
        .find(card => card.dataset.psPostKey === shared.key
          && card.classList.contains('post--single') !== shared.fromPost);
      const cover = target?.querySelector('.post-media');
      if (cover?.querySelector('img')?.getAttribute('src') === shared.src) mark(cover);
      else { clearCovers(); shared = null; }
    }
  }, { signal });
  document.addEventListener('astro:after-swap', () => {
    for (const { name, selector, rect } of outgoing) {
      const target = document.querySelector(selector);
      if (!target) continue;
      const next = target.getBoundingClientRect();
      const style = document.documentElement.style;
      style.setProperty(`--motion-${name}-old-x`, `${rect.left - next.left}px`);
      style.setProperty(`--motion-${name}-old-y`, `${rect.top - next.top}px`);
      style.setProperty(`--motion-${name}-old-width`, `${rect.width}px`);
    }
    const cover = document.querySelector('[data-shared-cover]');
    const img = cover?.querySelector('img');
    // Astro has restored history/anchor scroll before this hook. Measure the
    // actual destination; never fly a cover to an offscreen history position.
    if (shared && isVisible(cover) && img?.complete && img.naturalWidth) {
      document.documentElement.dataset.motionCover = 'shared';
    } else {
      clearCovers();
      document.documentElement.dataset.motionCover = 'fade';
    }
  }, { signal });
  signal.addEventListener('abort', () => { stop(); clear(); }, { once: true });
}

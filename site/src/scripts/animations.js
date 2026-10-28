// Only the first document uses WAAPI. Astro owns all subsequent navigation
// animations, so live DOM animations never compete with transition snapshots.
export function enterPage(root, reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches) {
  if (reducedMotion) return () => {};
  const candidates = root.querySelectorAll('.main > .wrapper > .post, .archive-title');
  const visible = [...candidates].filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  }).slice(0, 4);
  const animations = visible.map((el, index) => {
    const animation = el.animate([
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 280, delay: index * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    // A cancelled navigation rejects finished. Release effects on both paths.
    animation.finished.then(() => animation.cancel(), () => {});
    return animation;
  });
  return () => animations.forEach(animation => animation.cancel());
}

export function setupTransitions(signal) {
  let shared = null;
  let generation = 0;
  const clear = () => {
    document.querySelectorAll('[data-shared-cover]').forEach(img => {
      img.style.viewTransitionName = '';
      delete img.dataset.sharedCover;
    });
  };
  const mark = img => {
    img.style.viewTransitionName = 'post-cover';
    img.dataset.sharedCover = '';
  };
  document.addEventListener('astro:before-preparation', event => {
    generation++;
    const currentGeneration = generation;
    clear();
    shared = null;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const source = event.sourceElement?.closest('.post[data-ps-post-key]')
      || document.querySelector('.post--single[data-ps-post-key]');
    const img = source?.querySelector('.post-media img');
    if (!img?.complete || !img.naturalWidth) return;
    // Only match the same post between a list and its detail page.
    const key = source.dataset.psPostKey;
    const fromPost = Boolean(source.classList.contains('post--single'));
    if (!fromPost && event.to.pathname.replace(/\/$/, '') !== `/posts/${key}`) return;
    shared = { key, fromPost };
    mark(img);
    event.signal.addEventListener('abort', () => {
      if (generation !== currentGeneration) return;
      clear();
      shared = null;
    }, { once: true });
  }, { signal });
  document.addEventListener('astro:before-swap', event => {
    event.newDocument.documentElement.dataset.theme = document.documentElement.dataset.theme;
    const currentGeneration = generation;
    if (shared) {
      const cards = event.newDocument.querySelectorAll('.post[data-ps-post-key]');
      const target = [...cards].find(card => card.dataset.psPostKey === shared.key
        && card.classList.contains('post--single') !== shared.fromPost);
      const img = target?.querySelector('.post-media img');
      if (img) mark(img);
      else clear();
    }
    event.viewTransition.finished.finally(() => {
      if (currentGeneration === generation) clear();
    }).catch(() => {});
  }, { signal });
}

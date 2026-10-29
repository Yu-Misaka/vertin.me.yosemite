import test from 'node:test';
import assert from 'node:assert/strict';
import { enterPage, isVisible, navigationMotion, setupTransitions } from '../src/scripts/animations.js';

test('initial animation ignores offscreen cards, releases finished effects and cancels on navigation', async () => {
  globalThis.innerHeight = 800;
  globalThis.innerWidth = 1200;
  globalThis.matchMedia = () => ({ matches: false });
  const running = [];
  const card = top => ({
    getBoundingClientRect: () => ({ top, bottom: top + 200, left: 0, right: 600, width: 600, height: 200 }),
    animate: (_, options) => {
      let finish;
      const animation = { options, cancelled: false, finished: new Promise(resolve => { finish = resolve; }), cancel() { this.cancelled = true; }, finish: () => finish() };
      running.push(animation);
      return animation;
    },
  });
  const dispose = enterPage({ querySelectorAll: () => [card(0), card(400), card(1200)] }, false);
  assert.equal(running.length, 2);
  assert.equal(running[0].options.fill, 'backwards');
  running[0].finish();
  await Promise.resolve();
  assert.equal(running[0].cancelled, true);
  dispose();
  assert.equal(running[1].cancelled, true);
});

test('reduced motion does not hide or animate any content', () => {
  const dispose = enterPage({ querySelectorAll: () => { throw new Error('must not animate'); } }, true);
  assert.doesNotThrow(dispose);
});

test('only pagination within the same listing has horizontal direction', () => {
  const url = path => new URL(path, 'https://site.example');
  for (const [from, to, expected] of [
    ['/', '/page/2/', 'next'],
    ['/page/2/', '/', 'previous'],
    ['/tags/Lean/', '/tags/Lean/page/2/', 'next'],
    ['/categories/IT/page/3/', '/categories/IT/page/2/', 'previous'],
    ['/tags/Lean/', '/tags/Mathematica/', 'page'],
    ['/', '/posts/9/', 'page'],
    ['/posts/9/', '/posts/9/#comments', 'fade'],
    ['/', '/posts/9/#comments', 'fade'],
  ]) assert.equal(navigationMotion(url(from), url(to)), expected, `${from} → ${to}`);
});

test('hidden or offscreen covers cannot become shared elements', () => {
  globalThis.innerHeight = 800;
  globalThis.innerWidth = 1200;
  const rect = { left: 0, right: 600, width: 600, top: 0, bottom: 200, height: 200 };
  const visible = overrides => isVisible({ getBoundingClientRect: () => ({ ...rect, ...overrides }) });
  assert.equal(visible({}), true);
  assert.equal(visible({ top: 900, bottom: 1100 }), false);
  assert.equal(visible({ top: -300, bottom: -100 }), false);
  assert.equal(visible({ left: 1300, right: 1900 }), false);
  assert.equal(visible({ width: 0 }), false);
  assert.equal(isVisible(null), false);
});

test('superseded navigation cannot clear the newer transition; theme changes cancel it', async () => {
  const doc = Object.assign(new EventTarget(), {
    documentElement: { dataset: { theme: 'dark' } },
    startViewTransition() {},
    querySelectorAll: () => [],
    querySelector: () => null,
  });
  globalThis.document = doc;
  globalThis.matchMedia = () => ({ matches: false });
  const app = new AbortController();
  setupTransitions(app.signal);
  const dispatch = (name, props) => doc.dispatchEvent(Object.assign(new Event(name), props));
  const prepare = (controller, path) => dispatch('astro:before-preparation', {
    from: new URL('https://site.example/'), to: new URL(path, 'https://site.example'),
    signal: controller.signal,
  });
  const first = new AbortController();
  prepare(first, '/archives/');
  let finish;
  let skipped = 0;
  dispatch('astro:before-swap', {
    newDocument: { documentElement: { dataset: {} } },
    viewTransition: { finished: new Promise(resolve => { finish = resolve; }), skipTransition() { skipped++; } },
  });
  const second = new AbortController();
  prepare(second, '/page/2/');
  first.abort();
  finish();
  await Promise.resolve();
  assert.equal(doc.documentElement.dataset.motion, 'next');
  assert.equal(skipped, 1);
  dispatch('site:theme-change');
  assert.equal(doc.documentElement.dataset.motion, undefined);
  assert.equal(skipped, 2);
  app.abort();
});

test('cover reuse preserves the current hover frame and releases it on finish or cancellation', async t => {
  globalThis.innerHeight = 800;
  globalThis.innerWidth = 1200;
  globalThis.matchMedia = () => ({ matches: false });
  const previousGetComputedStyle = globalThis.getComputedStyle;
  const transform = 'matrix(1.0075, 0, 0, 1.0075, 0, 0)';
  globalThis.getComputedStyle = () => ({ transform });
  t.after(() => {
    if (previousGetComputedStyle) globalThis.getComputedStyle = previousGetComputedStyle;
    else delete globalThis.getComputedStyle;
  });
  for (const { hash, offscreen, loaded, expected, cancel } of [
    { hash: '', offscreen: false, loaded: true, expected: 'shared' },
    { hash: '', offscreen: false, loaded: true, expected: 'shared', cancel: 'navigation' },
    { hash: '', offscreen: false, loaded: true, expected: 'shared', cancel: 'theme' },
    { hash: '', offscreen: true, loaded: true, expected: 'fade' },
    { hash: '#comments', offscreen: false, loaded: true, expected: 'fade' },
    { hash: '', offscreen: false, loaded: false, expected: 'fade' },
  ]) {
    const image = { complete: loaded, naturalWidth: loaded ? 1600 : 0, getAttribute: () => '/cover.webp' };
    const makeCover = () => ({
      style: {
        properties: new Map(),
        setProperty(name, value) { this.properties.set(name, value); },
        removeProperty(name) { this.properties.delete(name); },
        getPropertyValue(name) { return this.properties.get(name) || ''; },
      }, dataset: {}, attributes: new Map(), top: 0,
      getBoundingClientRect() { return { top: this.top, bottom: this.top + 350, height: 350, width: 600, left: 0, right: 600 }; },
      querySelector: () => image,
      setAttribute(name, value) { this.attributes.set(name, value); },
      removeAttribute(name) { this.attributes.delete(name); },
    });
    const makeCard = single => ({
      dataset: { psPostKey: '9' }, classList: { contains: () => single }, cover: makeCover(),
      querySelector() { return this.cover; },
    });
    const source = makeCard(false);
    const target = makeCard(true);
    const makeDoc = card => Object.assign(new EventTarget(), {
      card, documentElement: { dataset: { theme: 'dark' } }, startViewTransition() {},
      querySelectorAll(selector) {
        return selector === '[data-shared-cover]'
          ? ('sharedCover' in this.card.cover.dataset ? [this.card.cover] : []) : [this.card];
      },
      querySelector() { return 'sharedCover' in this.card.cover.dataset ? this.card.cover : null; },
    });
    const doc = makeDoc(source);
    const destination = makeDoc(target);
    globalThis.document = doc;
    const app = new AbortController();
    const nav = new AbortController();
    setupTransitions(app.signal);
    const dispatch = (name, props = {}) => doc.dispatchEvent(Object.assign(new Event(name), props));
    dispatch('astro:before-preparation', {
      from: new URL('https://site.example/'), to: new URL(`https://site.example/posts/9/${hash}`),
      sourceElement: { closest: () => source }, signal: nav.signal,
    });
    assert.equal(source.cover.style.getPropertyValue('--motion-cover-transform'),
      !hash && loaded ? transform : '', 'freeze the actual intermediate scale, not the full hover target');
    let finish;
    dispatch('astro:before-swap', {
      newDocument: destination,
      viewTransition: { finished: new Promise(resolve => { finish = resolve; }), skipTransition() {} },
    });
    const persisted = target.cover.attributes.get('data-astro-transition-persist');
    if (persisted) {
      assert.equal(persisted, source.cover.attributes.get('data-astro-transition-persist'));
      assert.equal(target.cover.style.getPropertyValue('--motion-cover-transform'), transform);
      target.cover = source.cover; // Astro transfers the already decoded figure.
    }
    target.cover.top = offscreen ? 900 : 0;
    doc.card = target;
    dispatch('astro:after-swap');
    assert.equal(doc.documentElement.dataset.motionCover, expected);
    assert.equal('sharedCover' in target.cover.dataset, expected === 'shared');
    assert.equal(target.cover.style.getPropertyValue('--motion-cover-transform'), expected === 'shared' ? transform : '');
    if (cancel === 'navigation') nav.abort();
    if (cancel === 'theme') dispatch('site:theme-change');
    finish();
    await Promise.resolve();
    assert.equal(doc.documentElement.dataset.motionCover, undefined);
    assert.equal(target.cover.attributes.has('data-astro-transition-persist'), false);
    assert.equal(target.cover.style.getPropertyValue('--motion-cover-transform'), '');
    app.abort();
  }
});

test('a scrolled list snapshot stays at its original viewport position when entering an article', async () => {
  globalThis.matchMedia = () => ({ matches: false });
  const properties = new Map();
  let rect = { left: 299, top: -720, width: 670 };
  const doc = Object.assign(new EventTarget(), {
    documentElement: { dataset: { theme: 'dark' }, style: {
      setProperty: (key, value) => properties.set(key, value),
      removeProperty: key => properties.delete(key),
    } },
    startViewTransition() {}, querySelectorAll: () => [],
    querySelector: selector => selector === '.main' ? { getBoundingClientRect: () => rect } : null,
  });
  globalThis.document = doc;
  const app = new AbortController();
  setupTransitions(app.signal);
  const dispatch = (name, props = {}) => doc.dispatchEvent(Object.assign(new Event(name), props));
  dispatch('astro:before-preparation', {
    from: new URL('https://site.example/'), to: new URL('https://site.example/posts/9/'),
    signal: new AbortController().signal,
  });
  dispatch('astro:after-preparation');
  let finish;
  dispatch('astro:before-swap', {
    newDocument: { documentElement: { dataset: {} } },
    viewTransition: { finished: new Promise(resolve => { finish = resolve; }), skipTransition() {} },
  });
  rect = { left: 299, top: 25, width: 670 };
  dispatch('astro:after-swap');
  assert.equal(properties.get('--motion-content-old-y'), '-745px');
  assert.equal(properties.get('--motion-content-old-x'), '0px');
  assert.equal(properties.get('--motion-content-old-width'), '670px');
  finish();
  await Promise.resolve();
  assert.equal(properties.size, 0);
  app.abort();
});

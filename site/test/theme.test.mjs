import test from 'node:test';
import assert from 'node:assert/strict';

const media = Object.assign(new EventTarget(), { matches: false });
let reduced = false;
globalThis.matchMedia = query => query.includes('reduced-motion') ? { matches: reduced } : media;
const { setupTheme, syncTheme } = await import('../src/scripts/theme.js');

class Control extends EventTarget {
  attributes = new Map();
  dataset = {};
  textContent = '';
  setAttribute(name, value) { this.attributes.set(name, value); }
  closest() { return this.button ?? this; }
}

function fixture(t, { saved = 'auto', cookie = '', dark = false, reduce = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  media.matches = dark;
  reduced = reduce;
  const button = new Control();
  const icon = Object.assign(new Control(), { button });
  const status = new Control();
  const effects = [];
  icon.animate = () => {
    const effect = { cancelled: false, finished: new Promise(() => {}), cancel() { this.cancelled = true; } };
    effects.push(effect);
    return effect;
  };
  const storage = new Map([['theme', saved]]);
  const doc = Object.assign(new EventTarget(), {
    documentElement: { dataset: {} },
    querySelector: () => button,
    getElementById: id => ({ 'theme-icon': icon, 'theme-status': status })[id],
  });
  let cookieValue = cookie;
  Object.defineProperty(doc, 'cookie', {
    get: () => cookieValue,
    set: value => { cookieValue = value.split(';')[0]; },
  });
  globalThis.Element = Control;
  globalThis.document = doc;
  globalThis.location = { hostname: 'preview.example' };
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  globalThis.getComputedStyle = () => ({ getPropertyValue: key => key === '--motion-theme' ? '200ms' : '' });
  const controller = new AbortController();
  setupTheme(controller.signal);
  t.after(() => controller.abort());
  const click = (target = icon) => {
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: target });
    doc.dispatchEvent(event);
  };
  return { button, icon, status, storage, doc, controller, effects, click };
}

test('restored themes and repeated page initialization update the control without announcing a switch', t => {
  const { button, icon, status, doc } = fixture(t, { saved: 'light', cookie: 'theme=dark' });
  assert.equal(doc.documentElement.dataset.theme, 'dark', 'cookie preference takes precedence');
  assert.equal(icon.className, 'icon-moon-inv');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：深色模式');
  syncTheme();
  assert.equal(status.textContent, '', 'navigation must not replay a theme announcement');
  assert.equal(status.dataset.visible, undefined);
  doc.cookie = 'theme=unexpected';
  syncTheme();
  assert.equal(doc.documentElement.dataset.theme, 'light');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：跟随系统');
});

test('rapid toggles announce and persist the latest mode for its full display duration', t => {
  const { button, status, doc, storage, effects, click } = fixture(t);
  click();
  assert.equal(status.textContent, '已切换至浅色模式');
  assert.equal(storage.get('theme'), 'light');
  assert.equal(doc.cookie, 'theme=light');
  t.mock.timers.tick(1000);
  click();
  assert.equal(status.textContent, '已切换至深色模式');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：深色模式');
  assert.equal(effects[0].cancelled, true, 'superseded icon animation is released');
  t.mock.timers.tick(1900);
  assert.equal(status.dataset.visible, '', 'the old timer cannot dismiss the newer message');
  t.mock.timers.tick(700);
  assert.equal(status.dataset.visible, undefined);
  click();
  assert.equal(status.textContent, '主题已设为跟随系统');
  assert.equal(storage.get('theme'), 'auto');
  assert.equal(doc.documentElement.dataset.theme, 'light');
  assert.equal(button.attributes.get('title'), '切换主题，当前：跟随系统');
});

test('system changes apply only in automatic mode and retain the automatic control label', t => {
  const { button, status, doc, click } = fixture(t, { dark: true });
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：跟随系统');
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  assert.equal(doc.documentElement.dataset.theme, 'light');
  assert.equal(status.textContent, '', 'system changes do not create unsolicited toasts');
  click();
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(doc.documentElement.dataset.theme, 'light', 'manual light mode ignores system changes');
  click();
  click();
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：跟随系统');
});

test('disposing the theme lifecycle clears feedback and removes listeners before reinitialization', t => {
  const { status, doc, controller, effects, click } = fixture(t);
  click();
  controller.abort();
  assert.equal(status.dataset.visible, undefined);
  assert.equal(status.textContent, '');
  assert.equal(doc.documentElement.dataset.themeChanging, undefined);
  assert.equal(effects[0].cancelled, true);
  t.mock.timers.tick(5000);
  click();
  assert.equal(effects.length, 1, 'disposed click listeners cannot run');
  const replacement = new AbortController();
  setupTheme(replacement.signal);
  t.after(() => replacement.abort());
  click();
  assert.equal(effects.length, 2, 'reinitialization installs only one active handler');
  assert.equal(status.textContent, '已切换至深色模式');
});

test('reduced motion retains mode feedback without animating the icon', t => {
  const { status, button, effects, click } = fixture(t, { reduce: true });
  click();
  assert.equal(effects.length, 0);
  assert.equal(status.textContent, '已切换至浅色模式');
  assert.equal(button.attributes.get('aria-label'), '切换主题，当前：浅色模式');
  t.mock.timers.tick(2600);
  assert.equal(status.dataset.visible, undefined);
});

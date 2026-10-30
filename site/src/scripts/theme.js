import { motionDuration, motionEasing, prefersReducedMotion } from './animations.js';

const media = matchMedia('(prefers-color-scheme: dark)');
const themeLabels = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' };
// The gallery is designed dark-first; visitors without a saved choice start there.
const defaultTheme = 'dark';

function savedTheme() {
  try {
    const saved = document.cookie.match(/(?:^|;)\s*theme=([^;]+)/)?.[1] || localStorage.getItem('theme') || defaultTheme;
    return Object.hasOwn(themeLabels, saved) ? saved : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

export function syncTheme() {
  const saved = savedTheme();
  const effective = saved === 'auto' ? (media.matches ? 'dark' : 'light') : saved;
  document.documentElement.dataset.theme = effective;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = saved === 'auto' ? 'icon-auto' : saved === 'dark' ? 'icon-moon-inv' : 'icon-sun-inv';
  const button = document.querySelector('.theme-toggle');
  const label = `切换主题，当前：${themeLabels[saved]}`;
  button?.setAttribute('aria-label', label);
  button?.setAttribute('title', label);
}

export function setupTheme(signal) {
  let cancelIcon = () => {};
  let timer;
  let statusTimer;
  const prepareChange = () => {
    document.dispatchEvent(new Event('site:theme-change'));
    clearTimeout(timer);
    document.documentElement.dataset.themeChanging = '';
    timer = setTimeout(() => delete document.documentElement.dataset.themeChanging,
      motionDuration('--motion-theme', 200));
  };
  syncTheme();
  media.addEventListener('change', () => {
    if (savedTheme() === 'auto') { prepareChange(); syncTheme(); }
  }, { signal });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.theme-toggle')) return;
    const saved = savedTheme();
    const next = saved === 'auto' ? 'light' : saved === 'light' ? 'dark' : 'auto';
    try { localStorage.setItem('theme', next); } catch {}
    // Preserve the existing cross-subdomain preference on the production domain.
    const domain = location.hostname.endsWith('vertin.me') ? '; domain=vertin.me' : '';
    document.cookie = `theme=${next}; path=/; SameSite=Lax; max-age=31536000${domain}`;
    prepareChange();
    cancelIcon();
    syncTheme();
    // The live region belongs to the persisted header, so rapid toggles and
    // page navigation update one notification instead of creating a queue.
    const status = document.getElementById('theme-status');
    if (status) {
      clearTimeout(statusTimer);
      status.textContent = next === 'auto' ? '主题已设为跟随系统' : `已切换至${themeLabels[next]}`;
      status.dataset.visible = '';
      statusTimer = setTimeout(() => delete status.dataset.visible, 2600);
    }
    const icon = document.getElementById('theme-icon');
    if (icon && !prefersReducedMotion()) {
      const effect = icon.animate([
        { opacity: .5, transform: 'rotate(-35deg) scale(.9)' },
        { opacity: 1, transform: 'none' },
      ], { duration: motionDuration('--motion-theme', 200), easing: motionEasing() });
      cancelIcon = () => effect.cancel();
      effect.finished.then(cancelIcon, () => {});
    }
  }, { signal });
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    clearTimeout(statusTimer);
    cancelIcon();
    delete document.documentElement.dataset.themeChanging;
    const status = document.getElementById('theme-status');
    if (status) { delete status.dataset.visible; status.textContent = ''; }
  }, { once: true });
}

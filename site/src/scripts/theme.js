import { motionDuration, motionEasing, prefersReducedMotion } from './animations.js';

const media = matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    return document.cookie.match(/(?:^|;)\s*theme=([^;]+)/)?.[1] || localStorage.getItem('theme') || 'auto';
  } catch {
    return 'auto';
  }
}

export function syncTheme() {
  const saved = savedTheme();
  const effective = saved === 'auto' ? (media.matches ? 'dark' : 'light') : saved;
  document.documentElement.dataset.theme = effective;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = saved === 'auto' ? 'icon-auto' : saved === 'dark' ? 'icon-moon-inv' : 'icon-sun-inv';
}

export function setupTheme(signal) {
  let cancelIcon = () => {};
  let timer;
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
  signal.addEventListener('abort', () => { clearTimeout(timer); cancelIcon(); }, { once: true });
}

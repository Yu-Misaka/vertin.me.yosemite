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
  syncTheme();
  media.addEventListener('change', () => {
    if (savedTheme() === 'auto') syncTheme();
  }, { signal });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.theme-toggle')) return;
    const saved = savedTheme();
    const next = saved === 'auto' ? 'light' : saved === 'light' ? 'dark' : 'auto';
    try { localStorage.setItem('theme', next); } catch {}
    // Preserve the existing cross-subdomain preference on the production domain.
    const domain = location.hostname.endsWith('vertin.me') ? '; domain=vertin.me' : '';
    document.cookie = `theme=${next}; path=/; SameSite=Lax; max-age=31536000${domain}`;
    syncTheme();
  }, { signal });
}

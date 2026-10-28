const normalize = path => path.replace(/\/+$/, '') || '/';

// The address bar is authoritative for menu destinations. The page's declared
// parent is only used for articles, pagination and other non-menu destinations.
export function activeNavigationPath(pathname, parent, destinations) {
  const paths = destinations.map(normalize);
  const exact = normalize(pathname);
  if (paths.includes(exact)) return exact;
  if (parent && paths.includes(normalize(parent))) return normalize(parent);
  return null;
}

export function initNavigation() {
  const nav = document.querySelector('.header-nav');
  if (!nav) return;
  const items = [...nav.querySelectorAll('.nav-item')];
  const path = activeNavigationPath(location.pathname,
    document.getElementById('page-content')?.dataset.navCurrent,
    items.map(item => new URL(item.querySelector('a').href).pathname));
  const active = items.find(item => normalize(new URL(item.querySelector('a').href).pathname) === path);
  items.forEach(item => {
    item.classList.toggle('nav-item-current', item === active);
    const link = item.querySelector('a');
    if (item === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  // Clean up the former floating indicator in a persisted header after HMR.
  nav.querySelector('.nav-indicator')?.remove();
}

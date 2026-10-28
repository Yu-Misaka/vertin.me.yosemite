const normalize = path => path.replace(/\/$/, '') || '/';

export function initNavigation(signal) {
  const nav = document.querySelector('.header-nav');
  if (!nav) return;
  const items = [...nav.querySelectorAll('.nav-item')];
  const path = normalize(document.getElementById('page-content')?.dataset.navCurrent || location.pathname);
  const active = items.find(item => normalize(new URL(item.querySelector('a').href).pathname) === path);
  items.forEach(item => {
    item.classList.toggle('nav-item-current', item === active);
    const link = item.querySelector('a');
    if (item === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const indicator = nav.querySelector('.nav-indicator') || nav.appendChild(Object.assign(document.createElement('div'), { className: 'nav-indicator' }));
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active || !active.isConnected) {
        indicator.classList.remove('active');
        return;
      }
      const rect = active.getBoundingClientRect();
      const container = nav.getBoundingClientRect();
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.transform = `translate(${rect.left - container.left}px, ${rect.top - container.top}px)`;
      indicator.classList.add('active');
      // Initial measurement and responsive reflow should not fly from (0, 0).
      if (!indicator.dataset.positioned) {
        indicator.getBoundingClientRect();
        indicator.dataset.positioned = '';
      }
    });
  };
  const observer = new ResizeObserver(update);
  observer.observe(nav);
  items.forEach(item => observer.observe(item));
  document.fonts.ready.then(() => { if (!signal.aborted) update(); });
  signal.addEventListener('abort', () => { observer.disconnect(); cancelAnimationFrame(frame); }, { once: true });
  update();
}

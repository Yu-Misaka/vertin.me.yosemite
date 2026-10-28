import { motionDuration, motionEasing, prefersReducedMotion, reveal } from './animations.js';

export function initWidgets(root, signal) {
  const observers = [];
  const frames = new Set();
  const effects = new Set();
  const schedule = callback => {
    const frame = requestAnimationFrame(() => { frames.delete(frame); if (!signal.aborted) callback(); });
    frames.add(frame);
  };
  const stopEffects = () => effects.forEach(cancel => cancel());
  document.addEventListener('site:before-navigation', stopEffects, { signal });

  root.querySelectorAll('.collapsible-panel').forEach((panel, index) => {
    const button = panel.querySelector('.collapsible-header');
    const content = panel.querySelector('.collapsible-content');
    if (!button || !content) return;
    content.id ||= `collapse-${index}`;
    button.type = 'button';
    button.setAttribute('aria-controls', content.id);
    button.setAttribute('aria-expanded', 'false');
    // Older compiled shortcodes used an inline max-height that would otherwise
    // keep the measured-height animation clamped to zero.
    content.style.removeProperty('max-height');
    content.inert = true;
    const details = content.querySelector('.collapsible-details') || content;
    const update = () => {
      if (button.getAttribute('aria-expanded') === 'true') content.style.height = `${details.scrollHeight}px`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(details);
    observers.push(observer);
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      button.classList.toggle('active', expanded);
      content.inert = !expanded;
      content.style.height = expanded ? `${details.scrollHeight}px` : '0px';
      const icon = button.querySelector('.icon');
      icon?.classList.toggle('icon-up-open', expanded);
      icon?.classList.toggle('icon-down-open', !expanded);
    }, { signal });
  });

  root.querySelectorAll('.tab-container').forEach(container => {
    const header = container.querySelector('.tab-header');
    const body = container.querySelector('.tab-content');
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panes = [...container.querySelectorAll('[role="tabpanel"]')];
    const indicator = container.querySelector('.tab-indicator');
    if (!header || !tabs.length || !indicator) return;
    let cancelPane = () => {};
    let heightEffect;
    const cancel = () => { cancelPane(); heightEffect?.cancel(); };
    effects.add(cancel);
    const layout = () => {
      const active = tabs.find(tab => tab.classList.contains('active'));
      if (!active) return;
      const width = active.offsetWidth;
      indicator.style.width = `${width * .75}px`;
      indicator.style.transform = `translateX(${active.offsetLeft + width * .125}px)`;
      if (!indicator.dataset.positioned) {
        indicator.getBoundingClientRect();
        indicator.dataset.positioned = '';
      }
    };
    const select = (index, focus = true) => {
      const oldIndex = tabs.findIndex(tab => tab.classList.contains('active'));
      if (focus && oldIndex === index) return;
      // Measure before cancelling: interrupted height changes continue from the
      // currently rendered size rather than snapping to the previous endpoint.
      const oldHeight = body?.getBoundingClientRect().height;
      cancel();
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panes.forEach((pane, i) => {
        pane.classList.toggle('active', i === index);
        pane.hidden = i !== index;
      });
      if (focus) {
        tabs[index].focus({ preventScroll: true });
        if (!prefersReducedMotion()) {
          cancelPane = reveal(panes[index]);
          if (body && oldHeight !== undefined) {
            heightEffect = body.animate([
              { height: `${oldHeight}px`, overflow: 'clip' },
              { height: `${body.getBoundingClientRect().height}px`, overflow: 'clip' },
            ], { duration: motionDuration('--motion-page', 220), easing: motionEasing() });
            const effect = heightEffect;
            effect.finished.then(() => effect.cancel(), () => {});
          }
        }
      }
      schedule(layout);
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index), { signal });
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); select(next); }
      }, { signal });
    });
    container.querySelectorAll('.scroll-button').forEach(button => {
      button.addEventListener('click', () => header.scrollBy({
        left: button.classList.contains('left') ? -160 : 160,
        behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      }), { signal });
    });
    const observer = new ResizeObserver(() => schedule(layout));
    observer.observe(header);
    tabs.forEach(tab => observer.observe(tab));
    observers.push(observer);
    document.fonts.ready.then(() => { if (!signal.aborted) schedule(layout); });
    select(Math.max(0, tabs.findIndex(tab => tab.classList.contains('active'))), false);
  });

  signal.addEventListener('abort', () => {
    observers.forEach(observer => observer.disconnect());
    frames.forEach(frame => cancelAnimationFrame(frame));
    stopEffects();
    effects.clear();
  }, { once: true });
}

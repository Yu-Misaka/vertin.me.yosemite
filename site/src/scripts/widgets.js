export function initWidgets(root, signal) {
  const observers = [];
  const frames = new Set();
  const schedule = callback => {
    const frame = requestAnimationFrame(() => { frames.delete(frame); if (!signal.aborted) callback(); });
    frames.add(frame);
  };
  root.querySelectorAll('.collapsible-panel').forEach((panel, index) => {
    const button = panel.querySelector('.collapsible-header');
    const content = panel.querySelector('.collapsible-content');
    if (!button || !content) return;
    content.id ||= `collapse-${index}`;
    button.type = 'button';
    button.setAttribute('aria-controls', content.id);
    button.setAttribute('aria-expanded', 'false');
    content.inert = true;
    const update = () => {
      if (button.getAttribute('aria-expanded') === 'true') content.style.maxHeight = `${content.scrollHeight}px`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(content.querySelector('.collapsible-details') || content);
    observers.push(observer);
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      button.classList.toggle('active', expanded);
      content.inert = !expanded;
      content.style.maxHeight = expanded ? `${content.scrollHeight}px` : '0px';
      const icon = button.querySelector('.icon');
      icon?.classList.toggle('icon-up-open', expanded);
      icon?.classList.toggle('icon-down-open', !expanded);
    }, { signal });
  });

  root.querySelectorAll('.tab-container').forEach(container => {
    const header = container.querySelector('.tab-header');
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panes = [...container.querySelectorAll('[role="tabpanel"]')];
    const indicator = container.querySelector('.tab-indicator');
    if (!header || !tabs.length || !indicator) return;
    const layout = () => {
      const active = tabs.find(tab => tab.classList.contains('active'));
      if (!active) return;
      const width = active.offsetWidth;
      indicator.style.width = `${width * .75}px`;
      indicator.style.transform = `translateX(${active.offsetLeft + width * .125}px)`;
    };
    const select = (index, focus = true) => {
      const oldIndex = tabs.findIndex(tab => tab.classList.contains('active'));
      header.classList.toggle('dir-right', index >= oldIndex);
      header.classList.toggle('dir-left', index < oldIndex);
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panes.forEach((pane, i) => {
        pane.classList.toggle('active', i === index);
        pane.hidden = i !== index;
      });
      if (focus) tabs[index].focus();
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
      button.addEventListener('click', () => header.scrollBy({ left: button.classList.contains('left') ? -160 : 160, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), { signal });
    });
    const observer = new ResizeObserver(() => schedule(layout));
    observer.observe(header);
    tabs.forEach(tab => observer.observe(tab));
    observers.push(observer);
    select(Math.max(0, tabs.findIndex(tab => tab.classList.contains('active'))), false);
  });

  signal.addEventListener('abort', () => {
    observers.forEach(observer => observer.disconnect());
    frames.forEach(frame => cancelAnimationFrame(frame));
  }, { once: true });
}

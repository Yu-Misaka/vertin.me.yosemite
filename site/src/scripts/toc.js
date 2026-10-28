export function initToc(root, signal) {
  const section = root.querySelector('#toc-section');
  if (!section) return;
  const links = [...section.querySelectorAll('.toc-a')];
  const headings = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
  const marker = section.querySelector('.siderbar');
  const sidebar = section.closest('.right-sidebar');
  let positions = [];
  let threshold = 0;
  let frame = 0;
  let measureFrame = 0;
  let active = -1;

  const update = () => {
    frame = 0;
    const offset = scrollY + innerHeight * .15;
    let index = 0;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] <= offset) index = i;
      else break;
    }
    if (active !== index) {
      active = index;
      links.forEach((link, i) => {
        link.classList.toggle('li-active', i === index);
        if (i === index) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      if (marker && links[index]) marker.style.transform = `translateY(${links[index].closest('li').offsetTop + 4}px)`;
    }
    section.classList.toggle('sticky', scrollY > threshold);
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const measure = () => {
    cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      positions = headings.map(heading => heading ? heading.getBoundingClientRect().top + scrollY : Infinity);
      // Measure siblings, independent of whether the TOC is currently fixed.
      threshold = [...sidebar.children].filter(child => child !== section)
        .reduce((sum, child) => sum + child.offsetHeight + parseFloat(getComputedStyle(child).marginBottom || 0), 0) + 30;
      active = -1;
      scheduleUpdate();
    });
  };
  // Keep the sidebar's flow anchored to the article rather than to the viewport.
  sidebar.classList.add('has-toc');
  addEventListener('scroll', scheduleUpdate, { passive: true, signal });
  addEventListener('resize', measure, { passive: true, signal });
  root.addEventListener('load', measure, { capture: true, signal });
  section.addEventListener('click', event => {
    const link = event.target.closest('.toc-a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = links.indexOf(link);
    if (!headings[index]) return;
    event.preventDefault();
    // Push state without changing location.hash, which would cause a second jump.
    history.pushState(history.state, '', link.hash);
    headings[index].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, { signal });
  const observer = new ResizeObserver(measure);
  const article = root.querySelector('.post');
  if (article) observer.observe(article);
  document.fonts.ready.then(() => { if (!signal.aborted) measure(); });
  signal.addEventListener('abort', () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(measureFrame);
  }, { once: true });
  measure();
}

export function initGoTop(signal) {
  const button = document.getElementById('go-top');
  if (!button) return;
  let frame = 0;
  const update = () => { frame = 0; button.classList.toggle('visible', scrollY > 100); };
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true, signal });
  button.addEventListener('click', event => {
    event.preventDefault();
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, { signal });
  signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  update();
}

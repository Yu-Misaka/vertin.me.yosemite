/** Keep the page's content width and scroll position while a room is open. */
export function lockPageScroll(doc = document) {
  const html = doc.documentElement;
  const body = doc.body;
  const view = doc.defaultView;
  const previous = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    x: view.scrollX,
    y: view.scrollY
  };
  const width = body.getBoundingClientRect().width;
  const padding = parseFloat(view.getComputedStyle(body).paddingRight) || 0;

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';

  // clientWidth grows when the scrollbar disappears even if a stable gutter
  // still reserves its space. Measure the body instead, so that space is never
  // compensated twice; overlay scrollbars need no compensation at all.
  const reclaimed = body.getBoundingClientRect().width - width;
  if (reclaimed > 0) body.style.paddingRight = `${padding + reclaimed}px`;

  function restorePosition() {
    if (view.scrollX !== previous.x || view.scrollY !== previous.y) {
      view.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' });
    }
  }
  restorePosition();

  return () => {
    html.style.overflow = previous.htmlOverflow;
    body.style.overflow = previous.bodyOverflow;
    body.style.paddingRight = previous.paddingRight;
    restorePosition();
  };
}

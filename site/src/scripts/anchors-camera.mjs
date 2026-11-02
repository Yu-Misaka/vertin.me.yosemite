/**
 * Camera maths for the anchors room.
 *
 * A camera is `{ x, y, scale }`: the world point shown at the centre of the
 * viewport, plus how many screen pixels one world unit covers. Work rects are
 * `{ x, y, w, h }` in world units, top-left anchored. Keeping this pure lets
 * the feel of the room be tested without a DOM.
 */

export function worldToScreen(camera, viewport, point) {
  return {
    x: (point.x - camera.x) * camera.scale + viewport.width / 2,
    y: (point.y - camera.y) * camera.scale + viewport.height / 2
  };
}

export function screenToWorld(camera, viewport, point) {
  return {
    x: (point.x - viewport.width / 2) / camera.scale + camera.x,
    y: (point.y - viewport.height / 2) / camera.scale + camera.y
  };
}

export function projectRect(camera, viewport, rect) {
  const origin = worldToScreen(camera, viewport, rect);
  return { x: origin.x, y: origin.y, w: rect.w * camera.scale, h: rect.h * camera.scale };
}

/**
 * Pose that projects a world rect onto the screen box it should occupy. The
 * entry uses this to keep the cover exactly where the page drew it.
 */
export function poseForRect(rect, box, viewport, scale) {
  return {
    x: rect.x + rect.w / 2 - (box.x + box.w / 2 - viewport.width / 2) / scale,
    y: rect.y + rect.h / 2 - (box.y + box.h / 2 - viewport.height / 2) / scale,
    scale
  };
}

/**
 * Pose that puts a work's centre at the viewport centre, lifted so the label
 * below it keeps breathing room. `lift` is in screen pixels.
 */
export function centrePose(rect, scale, lift = 0) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + lift / scale, scale };
}

/** Zoom while keeping the world point under `anchor` (screen px) still. */
export function zoomAt(camera, viewport, anchor, scale) {
  const world = screenToWorld(camera, viewport, anchor);
  return {
    x: world.x - (anchor.x - viewport.width / 2) / scale,
    y: world.y - (anchor.y - viewport.height / 2) / scale,
    scale
  };
}

/** Scale at which the whole content fits the viewport with a margin. */
export function fitScale(content, viewport, margin = 0.08) {
  const width = Math.max(1, content.w) * (1 + margin * 2);
  const height = Math.max(1, content.h) * (1 + margin * 2);
  return Math.min(viewport.width / width, viewport.height / height);
}

/**
 * Keep the room navigable: the camera may look `escape` viewports past the
 * works, and no further. When the content is smaller than the viewport the
 * camera settles on its centre instead of inverting the bounds.
 */
export function clampCamera(camera, viewport, content, escape = 0.45) {
  const halfW = viewport.width / camera.scale / 2;
  const halfH = viewport.height / camera.scale / 2;
  const slackX = (viewport.width / camera.scale) * escape;
  const slackY = (viewport.height / camera.scale) * escape;
  const minX = content.x + halfW - slackX;
  const maxX = content.x + content.w - halfW + slackX;
  const minY = content.y + halfH - slackY;
  const maxY = content.y + content.h - halfH + slackY;
  return {
    x: minX > maxX ? content.x + content.w / 2 : Math.min(maxX, Math.max(minX, camera.x)),
    y: minY > maxY ? content.y + content.h / 2 : Math.min(maxY, Math.max(minY, camera.y)),
    scale: camera.scale
  };
}

/**
 * Grow the room's bounds just enough to contain a pose. The entry pose comes
 * from where the cover sat on the page, which can be outside the usual roam
 * range; clamping it away would make the first frame jump.
 */
export function boundsForPose(content, camera, viewport, escape = 0.45) {
  const halfW = viewport.width / camera.scale / 2;
  const halfH = viewport.height / camera.scale / 2;
  const slackX = (viewport.width / camera.scale) * escape;
  const slackY = (viewport.height / camera.scale) * escape;
  const x = Math.min(content.x, camera.x - halfW + slackX);
  const y = Math.min(content.y, camera.y - halfH + slackY);
  const right = Math.max(content.x + content.w, camera.x + halfW - slackX);
  const bottom = Math.max(content.y + content.h, camera.y + halfH - slackY);
  return { x, y, w: right - x, h: bottom - y };
}

/** Ease in and out; scale interpolates geometrically so zoom feels even. */
export function tweenPose(from, to, t) {
  const k = Math.min(1, Math.max(0, t));
  const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale * Math.pow(to.scale / from.scale, eased)
  };
}

/** The sides a wall label is willing to stand on, in order of preference. */
export const LABEL_SIDES = ['right', 'left', 'below', 'above'];

function labelBox(side, width, height, rect, gap) {
  if (side === 'right') return { x: rect.x + rect.w + gap, y: rect.y + rect.h - height, w: width, h: height };
  if (side === 'left') return { x: rect.x - gap - width, y: rect.y + rect.h - height, w: width, h: height };
  if (side === 'below') return { x: rect.x, y: rect.y + rect.h + gap, w: width, h: height };
  return { x: rect.x, y: rect.y - gap - height, w: width, h: height };
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** True when a label of this size could stand on this side without covering anything. */
export function labelFits(side, { size, rect, obstacles = [], viewport, safe = 18, gap = 30 }) {
  const box = labelBox(side, size.w, size.h, rect, gap);
  const safeBox = {
    x: safe,
    y: safe,
    w: Math.max(0, viewport.width - safe * 2),
    h: Math.max(0, viewport.height - safe * 2)
  };
  const inside = overlapArea(box, safeBox) >= size.w * size.h - 1e-6;
  if (!inside) return false;
  return !obstacles.some(obstacle => overlapArea(box, obstacle) > 1e-6);
}

/**
 * Where a wall label can stand. A real label lives beside its work, never on
 * top of one; if the room has no such spot — a narrow window, or two works
 * filling the frame — there is no label rather than a label on the art.
 * Returns null when nothing fits.
 */
export function labelPlacement({ size, rect, obstacles = [], viewport, safe = 18, gap = 30 }) {
  for (const side of LABEL_SIDES) {
    if (labelFits(side, { size, rect, obstacles, viewport, safe, gap })) {
      return labelBox(side, size.w, size.h, rect, gap);
    }
  }
  return null;
}

/**
 * The largest scale between `min` and `max` at which the label still stands
 * clear, solved by bisection so the label shrinks continuously as the room
 * closes in rather than in visible steps. Returns null when even `min` has
 * nowhere to stand.
 */
export function largestLabel({ size, rect, obstacles = [], viewport, min = 0.6, max = 1, safe = 18, gap = 30 }) {
  const scaled = scale => ({ w: size.w * scale, h: size.h * scale });
  const fits = (side, scale) => labelFits(side, { size: scaled(scale), rect, obstacles, viewport, safe, gap });

  for (const side of LABEL_SIDES) {
    if (!fits(side, min)) continue;
    if (fits(side, max)) {
      return { ...labelBox(side, size.w * max, size.h * max, rect, gap), scale: max, side };
    }
    let low = min;
    let high = max;
    for (let step = 0; step < 9; step += 1) {
      const middle = (low + high) / 2;
      if (fits(side, middle)) low = middle;
      else high = middle;
    }
    return { ...labelBox(side, size.w * low, size.h * low, rect, gap), scale: low, side };
  }
  return null;
}

/** Share of a work's own box that is on screen, 0 to 1. */
export function visibleFraction(camera, viewport, rect) {
  const box = projectRect(camera, viewport, rect);
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(viewport.width, box.x + box.w);
  const bottom = Math.min(viewport.height, box.y + box.h);
  if (right <= left || bottom <= top) return 0;
  return ((right - left) * (bottom - top)) / Math.max(1, box.w * box.h);
}

/**
 * Which work the visitor is looking at: the most centred one that is actually
 * in the room. Returns -1 when the camera is deep in the empty dark.
 */
export function litWork(camera, viewport, rects, minimum = 0.08) {
  let best = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (visibleFraction(camera, viewport, rect) < minimum) continue;
    const box = projectRect(camera, viewport, rect);
    const dx = box.x + box.w / 2 - viewport.width / 2;
    const dy = box.y + box.h / 2 - viewport.height / 2;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

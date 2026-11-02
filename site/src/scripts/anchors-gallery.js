import { holdSitePlayer } from './integrations.js';
import {
  boundsForPose,
  centrePose,
  largestLabel,
  clampCamera,
  fitScale,
  litWork,
  poseForRect,
  projectRect,
  tweenPose,
  visibleFraction,
  zoomAt
} from './anchors-camera.mjs';
import { createSky } from './anchors-sky.mjs';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// The anchors page turns its cover into the entrance of a dark room.
//
// The cover does not move into a modal: it is already the first work. The room
// waits in the dark around it, and the visitor's camera is what moves. Works
// keep their world rects for the whole visit, so choosing one walks the camera
// to it instead of swapping the picture in a single slot. Each work owns one
// track, and the audio behaves like a guide you carry: it keeps playing while
// you wander.
export function initAnchorsGallery(root, signal) {
  const overlay = root.querySelector('[data-anchors-gallery]');
  const trigger = root.querySelector('[data-anchors-open]');
  if (!overlay || !trigger) return;

  // `.main` uses `contain: layout`, which makes it a containing block for
  // fixed descendants. Portal the room to <body> so fixed means viewport.
  if (overlay.parentElement !== document.body) document.body.append(overlay);

  const viewportEl = overlay.querySelector('[data-gallery-viewport]');
  const worldEl = overlay.querySelector('[data-gallery-world]');
  const placard = overlay.querySelector('[data-gallery-placard]');
  const titleEl = overlay.querySelector('[data-gallery-title]');
  const noteEl = overlay.querySelector('[data-gallery-note]');
  const trackEl = overlay.querySelector('[data-gallery-track]');
  const playerEl = overlay.querySelector('[data-gallery-player]');
  const playBtn = overlay.querySelector('[data-gallery-play]');
  const currentEl = overlay.querySelector('[data-gallery-current]');
  const durationEl = overlay.querySelector('[data-gallery-duration]');
  const progressEl = overlay.querySelector('[data-gallery-progress]');
  const closeBtn = overlay.querySelector('[data-gallery-close]');
  const indexEl = overlay.querySelector('.anchors-gallery__index');
  const hintEl = overlay.querySelector('[data-gallery-hint]');
  const statusEl = overlay.querySelector('[data-gallery-status]');
  const indexButtons = [...overlay.querySelectorAll('[data-gallery-index]')];
  const works = [...overlay.querySelectorAll('[data-gallery-work]')];
  const audio = overlay.querySelector('[data-gallery-audio]');
  const skyEl = overlay.querySelector('[data-gallery-sky]');

  let data = {};
  try {
    data = JSON.parse(overlay.querySelector('[data-gallery-data]')?.textContent || '{}');
  } catch {
    data = {};
  }
  const items = data.works || [];
  const content = data.content;
  if (!items.length || !content || works.length !== items.length) return;
  const rects = items.map(item => item.rect);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const shell = document.querySelector('body > .wrapper');
  const pagePath = location.pathname + location.search;

  let open = false;
  let entryDone = false;
  let active = 0;
  let lit = -1;
  let viewport = { width: window.innerWidth, height: window.innerHeight };
  let viewScale = 1;
  let camera = { x: 0, y: 0, scale: 1 };
  let targetScale = 1;
  let bounds = content;
  let minScale = 0.1;
  let maxScale = 1;
  let zoomAnchor = { x: 0, y: 0 };
  let tween = null;
  let inertia = null;
  let frame = 0;
  let placardSize = { w: 260, h: 180 };
  let chromeBoxes = [];
  let placardVisible = false;
  let fadeToken = 0;
  let closingViaHistory = false;
  let savedFocus = null;
  let previousHtmlOverflow = '';
  let previousBodyOverflow = '';
  let shellWasInert = false;
  let releasePlayer = () => {};
  const skyRef = { x: content.x + content.w / 2, y: content.y + content.h / 2 };
  const sky = skyEl ? createSky(skyEl, { still: reducedMotion.matches }) : null;
  let pointer = null;
  let pinch = null;
  let velocity = { x: 0, y: 0 };
  const pointers = new Map();
  const timers = [];

  function later(fn, delay) {
    const id = setTimeout(fn, delay);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.length = 0;
  }

  function clampScale(scale) {
    return Math.min(maxScale, Math.max(minScale, scale));
  }

  function measure() {
    viewport = { width: window.innerWidth, height: window.innerHeight };
    const frame = trigger.getBoundingClientRect();
    // The cover's own width sets the viewing distance: it is the distance the
    // page already put the visitor at.
    viewScale = frame.width > 0 ? frame.width / rects[0].w : 0.5;
    const fit = fitScale(content, viewport, 0.06);
    minScale = Math.max(Math.min(fit, viewScale * 0.9), viewScale * 0.4);
    maxScale = viewScale * 1.4;
    targetScale = clampScale(targetScale);
    if (open) camera.scale = clampScale(camera.scale);
    return frame;
  }

  function apply() {
    const scale = camera.scale;
    worldEl.style.transform =
      `translate3d(${(viewport.width / 2 - camera.x * scale).toFixed(2)}px, ${(viewport.height / 2 - camera.y * scale).toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
    if (sky) {
      // The night drifts at a fraction of the camera's speed, and zooms less:
      // parallax is the only thing telling the eye how far away it is.
      const driftX = (camera.x - skyRef.x) * scale * 0.035;
      const driftY = (camera.y - skyRef.y) * scale * 0.035;
      const breathe = 1 + (scale / viewScale - 1) * 0.02;
      skyEl.style.transform =
        `translate3d(${(-driftX).toFixed(1)}px, ${(-driftY).toFixed(1)}px, 0) scale(${breathe.toFixed(4)})`;
    }
    if (!open) return;
    lightNearest();
    placePlacard();
  }

  function lightNearest() {
    const next = litWork(camera, viewport, rects);
    if (next === lit) return;
    lit = next;
    works.forEach((work, index) => {
      if (index === next) work.setAttribute('data-lit', '');
      else work.removeAttribute('data-lit');
    });
  }

  // The label belongs to the work, so it steps back with it instead of staying
  // a fixed panel over a shrinking room. The floor keeps it readable; anything
  // further and the label would be lying about how far away the work is.
  function placardScale() {
    return Math.min(1, Math.max(0.68, camera.scale / viewScale));
  }

  // Chrome is small and fixed, so it is measured once per layout rather than
  // every frame; the label must not end up on top of the way out.
  function measureChrome() {
    chromeBoxes = [closeBtn, indexEl]
      .filter(Boolean)
      .map(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x - 6, y: box.y - 6, w: box.width + 12, h: box.height + 12 };
      });
  }

  function placePlacard() {
    const rect = projectRect(camera, viewport, rects[active]);
    const base = placardScale();
    const obstacles = chromeBoxes.slice();
    for (let index = 0; index < rects.length; index += 1) {
      if (visibleFraction(camera, viewport, rects[index]) < 0.03) continue;
      obstacles.push(projectRect(camera, viewport, rects[index]));
    }

    // The label shrinks continuously as the wall closes in — the scale is
    // solved, not stepped — and it never stands on a painting.
    const placed = largestLabel({
      size: placardSize,
      rect,
      obstacles,
      viewport,
      min: 0.6,
      max: base
    });

    // Nowhere to stand means no label: fading out is better than standing on
    // the art, and the music keeps playing either way.
    const visible = Boolean(placed) &&
      entryDone &&
      visibleFraction(camera, viewport, rects[active]) > 0.25;
    if (visible !== placardVisible) {
      placardVisible = visible;
      placard.toggleAttribute('data-visible', visible);
    }
    if (!placed) return;

    placard.style.transform =
      `translate3d(${Math.round(placed.x)}px, ${Math.round(placed.y)}px, 0) scale(${placed.scale.toFixed(4)})`;
  }

  function layoutSky() {
    if (!sky) return;
    const pad = Math.max(120, Math.round(Math.min(viewport.width, viewport.height) * 0.16));
    sky.layout(viewport, pad);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function tick() {
    frame = 0;
    const now = performance.now();
    let busy = false;

    if (tween) {
      const progress = tween.duration > 0 ? (now - tween.start) / tween.duration : 1;
      camera = tweenPose(tween.from, tween.to, progress);
      if (progress >= 1) tween = null;
      else busy = true;
    } else if (Math.abs(camera.scale - targetScale) > 0.0005) {
      // Ease the scale so a wheel notch glides instead of snapping.
      const next = reducedMotion.matches
        ? targetScale
        : camera.scale + (targetScale - camera.scale) * 0.22;
      camera = zoomAt(camera, viewport, zoomAnchor, next);
      busy = true;
    }

    if (inertia) {
      const dt = Math.min(64, now - inertia.time) / 1000;
      inertia.time = now;
      camera.x -= (inertia.x * dt) / camera.scale;
      camera.y -= (inertia.y * dt) / camera.scale;
      const decay = Math.exp(-dt * 5.2);
      inertia.x *= decay;
      inertia.y *= decay;
      if (Math.hypot(inertia.x, inertia.y) < 30) inertia = null;
      else busy = true;
    }

    camera = clampCamera(camera, viewport, bounds);
    apply();
    if (busy) schedule();
  }

  function cancelMotion() {
    tween = null;
    inertia = null;
    targetScale = camera.scale;
  }

  function renderIndex() {
    indexButtons.forEach((button, index) => {
      if (index === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function renderPlacard() {
    const item = items[active];
    titleEl.textContent = item.title;
    noteEl.textContent = item.note || '';
    trackEl.textContent = item.track;
    placardSize = { w: placard.offsetWidth, h: placard.offsetHeight };
  }

  function announce() {
    const item = items[active];
    statusEl.textContent =
      `第 ${active + 1} 件，共 ${items.length} 件：《${item.title}》。正在播放：${item.track}`;
  }

  function updatePlaying(playing) {
    playerEl.toggleAttribute('data-playing', playing);
    playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
  }

  function setProgress(ratio) {
    progressEl.value = String(Math.round(ratio * 1000));
    progressEl.style.setProperty('--ag-progress', `${Math.round(ratio * 100)}%`);
  }

  function resetProgress() {
    setProgress(0);
    currentEl.textContent = '0:00';
    durationEl.textContent = '0:00';
  }

  function fadeAudio(target, duration, done, token = ++fadeToken) {
    const from = audio.volume;
    const start = performance.now();
    const step = now => {
      if (token !== fadeToken) return;
      const progress = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * progress));
      if (progress < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  function playTrack(token, fadeIn) {
    const attempt = audio.play();
    if (attempt?.then) {
      attempt.then(() => {
        if (!open || token !== fadeToken) return;
        audio.volume = 0;
        fadeAudio(1, fadeIn, undefined, token);
        updatePlaying(true);
      }).catch(() => updatePlaying(false));
    } else {
      updatePlaying(true);
    }
  }

  // The track belongs to the work, but the sound follows the visitor: walking
  // away never stops it, only choosing another work does.
  function setTrack({ fadeIn = 700 } = {}) {
    const token = ++fadeToken;
    const begin = () => {
      if (token !== fadeToken || !open) return;
      audio.src = items[active].audio;
      audio.volume = 0;
      resetProgress();
      audio.load();
      playTrack(token, fadeIn);
    };
    if (!audio.paused && audio.volume > 0.02) fadeAudio(0, 420, begin, token);
    else begin();
  }

  // Choosing a work changes what is playing and where the label sits — and
  // nothing else. Moving the camera is a separate, explicit request (`walkTo`),
  // because being carried across the room is exactly what breaks the feeling of
  // standing in it.
  function selectWork(index, { focus = false } = {}) {
    if (!open || !rects[index]) return;
    const changed = index !== active;
    active = index;
    works.forEach((work, position) => {
      if (position === index) work.setAttribute('data-active', '');
      else work.removeAttribute('data-active');
    });
    renderPlacard();
    renderIndex();
    placePlacard();
    if (changed) {
      setTrack();
      announce();
    }
    if (focus) works[index].focus({ preventScroll: true });
  }

  function walkTo(index, { focus = false } = {}) {
    if (!open || !rects[index]) return;
    selectWork(index);
    const lift = Math.min(64, Math.max(18, viewport.height * 0.05));
    const pose = centrePose(rects[index], viewScale, lift);
    const target = clampCamera(pose, viewport, bounds);
    zoomAnchor = { x: viewport.width / 2, y: viewport.height / 2 };
    targetScale = pose.scale;
    if (focus) works[index].focus({ preventScroll: true });

    if (reducedMotion.matches) {
      cancelMotion();
      camera = target;
      apply();
      return;
    }
    tween = { from: { ...camera }, to: target, start: performance.now(), duration: 820 };
    schedule();
  }

  function openRoom() {
    if (open) return;
    open = true;
    entryDone = false;
    placardVisible = false;
    active = 0;
    lit = -1;
    works[0].setAttribute('data-active', '');
    savedFocus = trigger;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('anchors-gallery-open');
    if (shell) {
      shellWasInert = shell.inert;
      shell.inert = true;
    }

    const box = measure();
    camera = poseForRect(
      rects[0],
      { x: box.left, y: box.top, w: box.width, h: box.height },
      viewport,
      viewScale
    );
    targetScale = viewScale;
    zoomAnchor = { x: viewport.width / 2, y: viewport.height / 2 };
    bounds = boundsForPose(content, camera, viewport);

    // The page crops the cover to a banner. Opening that crop into the whole
    // artwork is the first move of the room: same width, same centre, and the
    // trim disappears instead of the picture jumping. It is written while the
    // room is still hidden, so the crop has no transition of its own.
    const projected = projectRect(camera, viewport, rects[0]);
    const crop = Math.max(0, (projected.h - box.height) / 2);
    works[0].style.setProperty('--ag-crop', `${crop.toFixed(2)}px`);
    works[0].setAttribute('data-arrived', '');
    works.forEach(work => {
      work.style.removeProperty('transition-delay');
    });

    layoutSky();
    apply();
    overlay.hidden = false;
    renderPlacard();
    renderIndex();
    measureChrome();
    apply();
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    sky?.play();
    overlay.focus({ preventScroll: true });

    releasePlayer = holdSitePlayer();

    later(() => {
      entryDone = true;
      // The entry delays are one-shot: later lighting changes must not wait.
      works.forEach(work => {
        work.removeAttribute('data-arrived');
        work.style.transitionDelay = '0ms';
      });
      apply();
    }, reducedMotion.matches ? 120 : 1750);

    later(() => setTrack({ fadeIn: 1400 }), reducedMotion.matches ? 160 : 900);

    if (hintEl && !sessionStorage.getItem('anchors-room-hint')) {
      hintEl.textContent = matchMedia('(hover: none)').matches
        ? '单指移动 · 双指缩放 · 轻点画面走到它面前'
        : '拖动移动 · 滚轮缩放 · 点击画面走到它面前';
      later(() => hintEl.setAttribute('data-visible', ''), reducedMotion.matches ? 200 : 2400);
      later(() => hintEl.removeAttribute('data-visible'), 9000);
      try {
        sessionStorage.setItem('anchors-room-hint', '1');
      } catch {}
    }

    if (!history.state?.anchorsGallery) {
      // Keep Astro's index/scroll fields so leaving the room does not disturb
      // the router's direction tracking.
      history.pushState({ ...(history.state || {}), anchorsGallery: true }, '', location.href);
    }
  }

  function closeRoom({ immediate = false, resumeGlobal = true } = {}) {
    if (!open) return;
    open = false;
    entryDone = false;
    placardVisible = false;
    bounds = content;
    fadeToken += 1;
    clearTimers();
    tween = null;
    inertia = null;
    pointer = null;
    pinch = null;
    pointers.clear();
    if (immediate) {
      audio.pause();
      sky?.pause();
    } else {
      fadeAudio(0, 900, () => audio.pause());
      // Let the canvas fade with the room before it is cleared.
      setTimeout(() => {
        if (!open) sky?.pause();
      }, 540);
    }
    releasePlayer(resumeGlobal);
    releasePlayer = () => {};
    overlay.classList.remove('is-open');
    overlay.removeAttribute('data-dragging');
    placard.removeAttribute('data-visible');
    hintEl?.removeAttribute('data-visible');
    works.forEach(work => {
      work.removeAttribute('data-lit');
      work.removeAttribute('data-active');
      work.removeAttribute('data-arrived');
      work.style.removeProperty('--ag-crop');
      work.style.removeProperty('transition-delay');
    });

    const finish = () => {
      if (open) return;
      overlay.hidden = true;
      worldEl.style.transform = '';
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.classList.remove('anchors-gallery-open');
      if (shell) shell.inert = shellWasInert;
      if (savedFocus?.isConnected) savedFocus.focus({ preventScroll: true });
    };

    if (immediate) finish();
    else later(finish, reducedMotion.matches ? 0 : 460);

    if (!immediate && history.state?.anchorsGallery) {
      // Leave the room by stepping out of its history entry. The early window
      // listener in BaseLayout consumes this step before Astro's router sees it.
      closingViaHistory = true;
      history.back();
    }
  }

  // The early window listener in BaseLayout calls this before Astro's router
  // sees the event. Returning true consumes the history step.
  function onPopState(event) {
    // A real navigation to another page must reach Astro. Close the room first
    // so its overlay is gone before the outgoing snapshot is taken.
    if (location.pathname + location.search !== pagePath) {
      closingViaHistory = false;
      closeRoom({ immediate: true, resumeGlobal: false });
      return false;
    }
    if (event.state?.anchorsGallery) {
      if (!open) openRoom();
      return true;
    }
    if (open || closingViaHistory) {
      closingViaHistory = false;
      if (open) closeRoom({ resumeGlobal: true });
      return true;
    }
    return false;
  }

  function trapFocus(event) {
    const focusables = [...overlay.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hidden && !el.disabled);
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function nudge(dx, dy) {
    cancelMotion();
    camera = clampCamera(
      { x: camera.x + dx / camera.scale, y: camera.y + dy / camera.scale, scale: camera.scale },
      viewport,
      bounds
    );
    apply();
  }

  function zoomBy(factor) {
    zoomAnchor = { x: viewport.width / 2, y: viewport.height / 2 };
    targetScale = clampScale(targetScale * factor);
    if (reducedMotion.matches) {
      camera = zoomAt(camera, viewport, zoomAnchor, targetScale);
      apply();
    } else {
      schedule();
    }
  }

  function onKeydown(event) {
    if (!open) return;
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      closeRoom();
      return;
    }
    if (key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (key >= '1' && key <= '9') {
      const index = Number(key) - 1;
      if (index < items.length) {
        event.preventDefault();
        walkTo(index, { focus: true });
      }
      return;
    }
    const step = Math.min(360, Math.max(80, viewport.width * 0.16));
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    if (moves[key]) {
      event.preventDefault();
      nudge(moves[key][0], moves[key][1]);
      return;
    }
    if (key === '+' || key === '=') {
      event.preventDefault();
      zoomBy(1.15);
    } else if (key === '-' || key === '_') {
      event.preventDefault();
      zoomBy(1 / 1.15);
    }
  }

  function onPointerDown(event) {
    if (!open) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelMotion();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      viewportEl.setPointerCapture(event.pointerId);
    } catch {}

    if (pointers.size === 1) {
      pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        startedAt: performance.now(),
        moved: false,
        target: event.target
      };
      velocity = { x: 0, y: 0 };
    } else if (pointers.size === 2) {
      pointer = null;
      startPinch();
    }
  }

  function onPointerMove(event) {
    if (!open || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && pinch) {
      movePinch();
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;

    if (!pointer.moved) {
      const travel = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (travel <= 6) return;
      pointer.moved = true;
      overlay.setAttribute('data-dragging', '');
    }

    const now = performance.now();
    const dt = Math.max(1, now - pointer.lastTime) / 1000;
    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    velocity = { x: dx / dt, y: dy / dt };
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastTime = now;

    camera = clampCamera(
      { x: camera.x - dx / camera.scale, y: camera.y - dy / camera.scale, scale: camera.scale },
      viewport,
      bounds
    );
    apply();
  }

  function onPointerUp(event) {
    if (!open) return;
    const wasPinch = pointers.size > 1;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;

    if (pointers.size === 1) {
      // One finger lifted mid-pinch: let the other one keep panning.
      const [id, point] = [...pointers.entries()][0];
      pointer = {
        id,
        startX: point.x,
        startY: point.y,
        lastX: point.x,
        lastY: point.y,
        lastTime: performance.now(),
        startedAt: performance.now(),
        moved: true,
        target: null
      };
      return;
    }
    if (wasPinch) {
      pointer = null;
      return;
    }

    const tap = pointer && !pointer.moved && performance.now() - pointer.startedAt < 360;
    const target = pointer?.target;
    const travel = pointer ? Math.hypot(velocity.x, velocity.y) : 0;
    overlay.removeAttribute('data-dragging');

    if (tap && target) {
      const work = target.closest?.('[data-gallery-work]');
      if (work) selectWork(Number(work.dataset.index));
    } else if (pointer?.moved && !reducedMotion.matches && travel > 160) {
      inertia = { x: velocity.x, y: velocity.y, time: performance.now() };
      schedule();
    }
    pointer = null;
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      scale: camera.scale,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    };
  }

  function movePinch() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const next = clampScale(pinch.scale * (distance / pinch.distance));
    const zoomed = zoomAt(camera, viewport, mid, next);
    camera = clampCamera(
      {
        x: zoomed.x - (mid.x - pinch.mid.x) / next,
        y: zoomed.y - (mid.y - pinch.mid.y) / next,
        scale: next
      },
      viewport,
      bounds
    );
    pinch.mid = mid;
    targetScale = next;
    apply();
  }

  function onWheel(event) {
    if (!open) return;
    event.preventDefault();
    tween = null;
    inertia = null;
    zoomAnchor = { x: event.clientX, y: event.clientY };
    const delta = Math.max(-120, Math.min(120, event.deltaY));
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0024));
    targetScale = clampScale(targetScale * factor);
    if (reducedMotion.matches) {
      camera = zoomAt(camera, viewport, zoomAnchor, targetScale);
      apply();
      return;
    }
    schedule();
  }

  function togglePlay() {
    if (audio.paused) {
      if (!audio.src) {
        setTrack({ fadeIn: 600 });
        return;
      }
      audio.volume = 0;
      const token = fadeToken;
      const attempt = audio.play();
      if (attempt?.then) {
        attempt.then(() => {
          if (!open || token !== fadeToken) return;
          fadeAudio(1, 600, undefined, token);
          updatePlaying(true);
        }).catch(() => updatePlaying(false));
      }
    } else {
      fadeAudio(0, 400, () => audio.pause());
    }
  }

  function seek() {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const ratio = Number(progressEl.value) / 1000;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
    currentEl.textContent = formatTime(audio.currentTime);
  }

  trigger.addEventListener('click', openRoom, { signal });
  closeBtn.addEventListener('click', () => closeRoom(), { signal });
  playBtn.addEventListener('click', togglePlay, { signal });
  progressEl.addEventListener('input', seek, { signal });
  indexButtons.forEach(button => button.addEventListener('click', () => {
    walkTo(Number(button.dataset.index));
  }, { signal }));
  works.forEach((work, index) => {
    work.addEventListener('focus', () => {
      if (!open || !work.matches(':focus-visible')) return;
      if (index === active) return;
      walkTo(index);
    }, { signal });
  });

  viewportEl.addEventListener('pointerdown', onPointerDown, { signal });
  viewportEl.addEventListener('pointermove', onPointerMove, { signal });
  viewportEl.addEventListener('pointerup', onPointerUp, { signal });
  viewportEl.addEventListener('pointercancel', onPointerUp, { signal });
  viewportEl.addEventListener('wheel', onWheel, { signal, passive: false });

  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
  }, { signal });
  audio.addEventListener('timeupdate', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const ratio = audio.currentTime / audio.duration;
    setProgress(ratio);
    currentEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(audio.duration);
  }, { signal });
  audio.addEventListener('play', () => updatePlaying(true), { signal });
  audio.addEventListener('pause', () => updatePlaying(false), { signal });
  audio.addEventListener('ended', () => {
    updatePlaying(false);
    setProgress(0);
    currentEl.textContent = '0:00';
  }, { signal });

  window.addEventListener('resize', () => {
    if (!open) return;
    measure();
    layoutSky();
    renderPlacard();
    measureChrome();
    camera = clampCamera(camera, viewport, bounds);
    apply();
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (!sky || !open) return;
    if (document.hidden) sky.sleep();
    else sky.wake();
  }, { signal });

  window.__anchorsGalleryPopState = onPopState;
  document.addEventListener('keydown', onKeydown, { signal });
  document.addEventListener('site:before-navigation', () => {
    // Turn the room's history entry back into the anchors entry before Astro
    // pushes the destination, so back navigation stays on the right page.
    if (history.state?.anchorsGallery) {
      const { anchorsGallery, ...rest } = history.state;
      history.replaceState(rest, '', location.href);
    }
    closeRoom({ immediate: true, resumeGlobal: false });
  }, { signal });

  signal.addEventListener('abort', () => {
    if (window.__anchorsGalleryPopState === onPopState) delete window.__anchorsGalleryPopState;
    clearTimers();
    closeRoom({ immediate: true, resumeGlobal: false });
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    overlay.remove();
  }, { once: true });
}

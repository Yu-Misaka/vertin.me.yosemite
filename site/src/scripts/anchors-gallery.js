import { holdSitePlayer } from './integrations.js';

const pad = value => String(value).padStart(2, '0');

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// The anchors page turns its cover into the entrance of a small listening room.
// The cover is not moved into a modal: the room darkens around the exact rect
// the cover already occupies, then the label, player and wall emerge from the
// dark. Each exhibit owns one image and one track.
export function initAnchorsGallery(root, signal) {
  const overlay = root.querySelector('[data-anchors-gallery]');
  const trigger = root.querySelector('[data-anchors-open]');
  if (!overlay || !trigger) return;

  // `.main` uses `contain: layout`, which makes it a containing block for
  // fixed descendants. Portal the room to <body> so fixed means viewport.
  if (overlay.parentElement !== document.body) document.body.append(overlay);

  let exhibits = [];
  try {
    exhibits = JSON.parse(overlay.querySelector('[data-gallery-data]')?.textContent || '[]');
  } catch {
    exhibits = [];
  }
  if (!exhibits.length) return;

  const mainLayer = overlay.querySelector('[data-gallery-main]');
  const nextLayer = overlay.querySelector('[data-gallery-next]');
  const info = overlay.querySelector('[data-gallery-info]');
  const countEl = overlay.querySelector('[data-gallery-count]');
  const titleEl = overlay.querySelector('[data-gallery-title]');
  const noteEl = overlay.querySelector('[data-gallery-note]');
  const trackEl = overlay.querySelector('[data-gallery-track]');
  const playerEl = overlay.querySelector('[data-gallery-player]');
  const playBtn = overlay.querySelector('[data-gallery-play]');
  const currentEl = overlay.querySelector('[data-gallery-current]');
  const durationEl = overlay.querySelector('[data-gallery-duration]');
  const progressEl = overlay.querySelector('[data-gallery-progress]');
  const closeBtn = overlay.querySelector('[data-gallery-close]');
  const thumbs = [...overlay.querySelectorAll('[data-gallery-thumb]')];
  const audio = overlay.querySelector('[data-gallery-audio]');

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const itemAt = index => exhibits[index] ?? exhibits[0];
  const pagePath = location.pathname + location.search;
  const shell = document.querySelector('body > .wrapper');

  let active = 0;
  let open = false;
  let closingViaHistory = false;
  let frontLayer = mainLayer;
  let backLayer = nextLayer;
  let savedFocus = null;
  let releasePlayer = () => {};
  let previousHtmlOverflow = '';
  let previousBodyOverflow = '';
  let shellWasInert = false;
  let fadeToken = 0;
  let switchToken = 0;
  let switching = false;

  function resetArt(item) {
    frontLayer = mainLayer;
    backLayer = nextLayer;
    frontLayer.src = item.image;
    frontLayer.alt = item.title;
    frontLayer.width = item.width;
    frontLayer.height = item.height;
    frontLayer.style.opacity = '1';
    frontLayer.setAttribute('data-gallery-main', '');
    frontLayer.removeAttribute('aria-hidden');
    backLayer.removeAttribute('data-gallery-main');
    backLayer.setAttribute('aria-hidden', 'true');
    backLayer.alt = '';
    backLayer.style.opacity = '0';
  }

  function renderMeta() {
    const item = itemAt(active);
    countEl.textContent = `${pad(active + 1)} / ${pad(exhibits.length)}`;
    titleEl.textContent = item.title;
    noteEl.textContent = item.note || '';
    noteEl.hidden = !item.note;
    trackEl.textContent = item.track;
  }

  function renderThumbs() {
    const others = exhibits
      .map((item, index) => ({ item, index }))
      .filter(entry => entry.index !== active);
    thumbs.forEach((button, slot) => {
      const entry = others[slot];
      if (!entry) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      button.dataset.index = String(entry.index);
      button.setAttribute('aria-label', `查看《${entry.item.title}》`);
      const img = button.querySelector('[data-thumb-image]');
      if (img.getAttribute('src') !== entry.item.image) img.src = entry.item.image;
      img.width = entry.item.width;
      img.height = entry.item.height;
      button.querySelector('[data-thumb-index]').textContent = pad(entry.index + 1);
      button.querySelector('[data-thumb-title]').textContent = entry.item.title;
    });
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
      audio.volume = from + (target - from) * progress;
      if (progress < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  function loadTrack({ play = true } = {}) {
    const item = itemAt(active);
    const token = ++fadeToken;
    const begin = () => {
      if (token !== fadeToken) return;
      audio.pause();
      audio.src = item.audio;
      audio.volume = 0;
      resetProgress();
      audio.load();
      if (!play) {
        updatePlaying(false);
        return;
      }
      const attempt = audio.play();
      if (attempt?.then) {
        attempt.then(() => {
          if (!open || token !== fadeToken) return;
          fadeAudio(1, 900, undefined, token);
          updatePlaying(true);
        }).catch(() => updatePlaying(false));
      } else {
        updatePlaying(true);
      }
    };
    // Let the previous track leave before the new one arrives.
    if (!audio.paused && audio.volume > 0) fadeAudio(0, 260, begin, token);
    else begin();
  }

  function switchTo(index) {
    if (index === active || switching || !exhibits[index]) return;
    switching = true;
    const token = ++switchToken;
    active = index;
    renderThumbs();
    renderMeta();
    loadTrack({ play: true });

    const item = itemAt(active);
    backLayer.src = item.image;
    backLayer.alt = item.title;
    backLayer.style.opacity = '0';
    const reveal = () => {
      if (token !== switchToken) return;
      backLayer.style.opacity = '1';
      frontLayer.style.opacity = '0';
      setTimeout(() => {
        if (token !== switchToken) return;
        frontLayer.removeAttribute('data-gallery-main');
        frontLayer.setAttribute('aria-hidden', 'true');
        frontLayer.alt = '';
        backLayer.setAttribute('data-gallery-main', '');
        backLayer.removeAttribute('aria-hidden');
        [frontLayer, backLayer] = [backLayer, frontLayer];
        backLayer.style.opacity = '0';
        switching = false;
      }, 400);
    };
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(reveal));
    if (backLayer.complete) settle();
    else {
      backLayer.addEventListener('load', settle, { once: true });
      backLayer.addEventListener('error', settle, { once: true });
    }
  }

  function openGallery() {
    if (open) return;
    open = true;
    active = 0;
    switchToken += 1;
    switching = false;
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

    // The artwork's box is the cover's hovered image; its visible window starts
    // clipped to the frame. Expanding the window past the old border is the
    // "frame dissolving" moment, so the hovered zoom is never lost.
    const cover = trigger.getBoundingClientRect();
    const coverImg = trigger.querySelector('img');
    const image = coverImg ? coverImg.getBoundingClientRect() : cover;
    const scaleX = cover.width ? image.width / cover.width : 1;
    const scaleY = cover.height ? image.height / cover.height : 1;
    const fullWidth = cover.width * scaleX;
    const fullHeight = cover.height * scaleY;
    const fullLeft = cover.left - (fullWidth - cover.width) / 2;
    const fullTop = cover.top - (fullHeight - cover.height) / 2;
    const insetX = (fullWidth - cover.width) / 2;
    const insetY = (fullHeight - cover.height) / 2;
    const card = trigger.closest('.post-inner');
    const radius = (card ? getComputedStyle(card).borderTopLeftRadius : '') || '.75rem';
    const coverFilter = coverImg ? getComputedStyle(coverImg).filter : 'none';
    overlay.style.setProperty('--ag-art-x', `${cover.left}px`);
    overlay.style.setProperty('--ag-art-y', `${cover.top}px`);
    overlay.style.setProperty('--ag-art-w', `${cover.width}px`);
    overlay.style.setProperty('--ag-art-h', `${cover.height}px`);
    overlay.style.setProperty('--ag-art-full-x', `${fullLeft}px`);
    overlay.style.setProperty('--ag-art-full-y', `${fullTop}px`);
    overlay.style.setProperty('--ag-art-full-w', `${fullWidth}px`);
    overlay.style.setProperty('--ag-art-full-h', `${fullHeight}px`);
    overlay.style.setProperty('--ag-art-radius', radius);
    overlay.style.setProperty('--ag-clip-start', `inset(${insetY}px ${insetX}px round ${radius} ${radius} 0 0)`);
    overlay.style.setProperty('--ag-art-filter', coverFilter || 'none');
    const below = innerHeight - cover.bottom;
    const above = cover.top;
    overlay.dataset.placement = below >= 220 || below >= above ? 'below' : 'above';

    overlay.hidden = false;
    resetArt(itemAt(active));
    renderThumbs();
    renderMeta();
    resetProgress();
    info.scrollTop = 0;
    // Let the clipped window paint once, then dissolve the frame and let the
    // hovered image brighten into the spotlight.
    void overlay.offsetWidth;
    overlay.style.setProperty('--ag-art-filter', 'none');
    overlay.classList.add('is-open');

    releasePlayer = holdSitePlayer();
    loadTrack({ play: true });

    if (!history.state?.anchorsGallery) {
      // Keep Astro's index/scroll fields so leaving the room does not disturb
      // the router's direction tracking.
      history.pushState({ ...(history.state || {}), anchorsGallery: true }, '', location.href);
    }
    requestAnimationFrame(() => overlay.focus({ preventScroll: true }));
  }

  function closeGallery({ immediate = false, resumeGlobal = true } = {}) {
    if (!open) return;
    open = false;
    switchToken += 1;
    switching = false;
    fadeToken += 1;
    if (immediate) audio.pause();
    else fadeAudio(0, 900, () => audio.pause());
    releasePlayer(resumeGlobal);
    releasePlayer = () => {};
    overlay.classList.remove('is-open');

    const finish = () => {
      if (open) return;
      overlay.hidden = true;
      overlay.dataset.placement = '';
      for (const name of ['x', 'y', 'w', 'h', 'full-x', 'full-y', 'full-w', 'full-h', 'filter', 'radius']) {
        overlay.style.removeProperty(`--ag-art-${name}`);
      }
      overlay.style.removeProperty('--ag-clip-start');
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.classList.remove('anchors-gallery-open');
      if (shell) shell.inert = shellWasInert;
      if (savedFocus?.isConnected) savedFocus.focus({ preventScroll: true });
    };

    if (immediate) finish();
    else setTimeout(finish, reducedMotion.matches ? 0 : 480);

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
      closeGallery({ immediate: true, resumeGlobal: false });
      return false;
    }
    if (event.state?.anchorsGallery) {
      if (!open) openGallery();
      return true;
    }
    if (open || closingViaHistory) {
      closingViaHistory = false;
      if (open) closeGallery({ resumeGlobal: true });
      return true;
    }
    return false;
  }

  function onKeydown(event) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
      return;
    }
    if (event.key !== 'Tab') return;
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

  function togglePlay() {
    if (audio.paused) {
      if (!audio.src) {
        loadTrack({ play: true });
        return;
      }
      audio.volume = 0;
      const attempt = audio.play();
      if (attempt?.then) {
        attempt.then(() => {
          if (!open) return;
          fadeAudio(1, 600);
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

  trigger.addEventListener('click', openGallery, { signal });
  closeBtn.addEventListener('click', () => closeGallery(), { signal });
  playBtn.addEventListener('click', togglePlay, { signal });
  progressEl.addEventListener('input', seek, { signal });
  thumbs.forEach(button => button.addEventListener('click', () => {
    switchTo(Number(button.dataset.index));
  }, { signal }));

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

  window.__anchorsGalleryPopState = onPopState;
  document.addEventListener('keydown', onKeydown, { signal });
  document.addEventListener('site:before-navigation', () => {
    // Turn the room's history entry back into the anchors entry before Astro
    // pushes the destination, so back navigation stays on the right page.
    if (history.state?.anchorsGallery) {
      const { anchorsGallery, ...rest } = history.state;
      history.replaceState(rest, '', location.href);
    }
    closeGallery({ immediate: true, resumeGlobal: false });
  }, { signal });

  signal.addEventListener('abort', () => {
    if (window.__anchorsGalleryPopState === onPopState) delete window.__anchorsGalleryPopState;
    closeGallery({ immediate: true, resumeGlobal: false });
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    overlay.remove();
  }, { once: true });
}

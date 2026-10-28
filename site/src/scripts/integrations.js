let twikooPromise;
let playerPromise;
let player;
let commentId = 0;
const counts = new Map();

export function onIdle(callback, signal, timeout = 1500) {
  const invoke = () => { if (!signal.aborted) callback(); };
  const idle = 'requestIdleCallback' in window;
  const id = idle ? requestIdleCallback(invoke, { timeout }) : setTimeout(invoke, 200);
  signal.addEventListener('abort', () => idle ? cancelIdleCallback(id) : clearTimeout(id), { once: true });
}

function loadTwikoo() {
  if (window.twikoo) return Promise.resolve(window.twikoo);
  if (twikooPromise) return twikooPromise;
  // This legacy UMD bundle contains precompiled Vue render functions. Serve it
  // unchanged as a hashed local asset; running it through an ESM bundler breaks
  // its component interop. It is still loaded only once, near the comment UI.
  twikooPromise = new Promise((resolve, reject) => {
    const existingStyles = new Set(document.head.querySelectorAll('style'));
    const script = document.createElement('script');
    script.src = new URL('../../node_modules/twikoo/dist/twikoo.all.min.js', import.meta.url).href;
    script.async = true;
    const timeout = setTimeout(() => fail(new Error('评论组件加载超时')), 15000);
    const fail = error => {
      clearTimeout(timeout);
      script.remove();
      reject(error);
    };
    script.onload = () => {
      clearTimeout(timeout);
      // Astro replaces <head> on navigation. Preserve the vendor's injected CSS
      // in a stable host so the cached script need not execute again.
      const host = document.getElementById('twikoo-styles');
      if (host) document.head.querySelectorAll('style').forEach(style => {
        if (!existingStyles.has(style) && style !== host) {
          host.textContent += style.textContent;
          style.remove();
        }
      });
      if (window.twikoo) resolve(window.twikoo);
      else fail(new Error('评论组件不可用'));
    };
    script.onerror = () => fail(new Error('评论组件加载失败'));
    document.head.append(script);
  }).catch(error => { twikooPromise = null; throw error; });
  return twikooPromise;
}

export async function updateCommentCounts(root, signal) {
  const links = [...root.querySelectorAll('.meta-comment')];
  const envId = document.documentElement.dataset.twikooEnv;
  if (!envId || !links.length || signal.aborted) return;
  const paths = [...new Set(links.map(link => new URL(link.href).pathname))];
  const apply = () => links.forEach(link => {
    const count = counts.get(`${envId}:${new URL(link.href).pathname}`);
    if (count !== undefined && link.isConnected) link.textContent = count ? ` ${count} 条评论` : ' 暂无评论';
  });
  apply();
  const missing = paths.filter(path => !counts.has(`${envId}:${path}`));
  if (!missing.length) return;
  try {
    let result;
    if (/^https?:\/\//.test(envId)) {
      // The self-hosted Twikoo HTTP API does not need the Vue/widget bundle for
      // public counts. Keep that much larger chunk exclusive to the comment UI.
      const response = await fetch(envId, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ event: 'GET_COMMENTS_COUNT', envId, urls: missing, includeReply: false }),
      });
      if (!response.ok) throw new Error(`Twikoo: ${response.status}`);
      const payload = await response.json();
      result = payload.data;
    } else {
      const api = await loadTwikoo();
      if (signal.aborted) return;
      result = await api.getCommentsCount({ envId, urls: missing, includeReply: false });
    }
    if (signal.aborted) return;
    for (const item of result || []) counts.set(`${envId}:${item.url}`, item.count);
    apply();
  } catch (error) {
    if (!signal.aborted) console.warn('评论数暂时不可用', error);
  }
}

export function initComments(root, signal) {
  const container = root.querySelector('#tcomment');
  const envId = document.documentElement.dataset.twikooEnv;
  onIdle(() => updateCommentCounts(root, signal), signal);
  if (!container || !envId) {
    return;
  }
  const path = location.pathname;
  let loading = false;
  let initialized = false;
  const destroy = () => {
    // Twikoo 1.6 mounts a Vue 2 root inside our disposable container.
    // Destroy it before Astro detaches the document to release its listeners.
    container.firstElementChild?.__vue__?.$destroy();
  };
  const load = async () => {
    if (loading || initialized || signal.aborted) return;
    loading = true;
    container.textContent = '正在加载评论…';
    try {
      const api = await loadTwikoo();
      if (signal.aborted || !container.isConnected) return;
      const mount = document.createElement('div');
      mount.id = `twikoo-page-${++commentId}`;
      container.replaceChildren(mount);
      await api.init({ envId, el: `#${mount.id}`, path });
      if (signal.aborted) { destroy(); return; }
      if (!container.querySelector('.twikoo')) throw new Error('评论组件未能挂载');
      initialized = true;
      updateCommentCounts(root, signal);
    } catch (error) {
      if (signal.aborted) return;
      console.warn('评论暂时不可用', error);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '评论加载失败，点击重试';
      retry.addEventListener('click', load, { signal });
      container.replaceChildren(retry);
    } finally {
      loading = false;
    }
  };
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
  }, { rootMargin: '400px 0px' });
  observer.observe(container);
  signal.addEventListener('abort', () => { observer.disconnect(); destroy(); }, { once: true });
}

export async function initPlayer(signal) {
  const container = document.getElementById('aplayer');
  if (!container || player) return;
  try {
    const config = JSON.parse(container.dataset.aplayerConfig);
    playerPromise ||= import('aplayer');
    const { default: APlayer } = await playerPromise;
    if (signal.aborted || player || !container.isConnected) return;
    player = new APlayer({ container, ...config, preload: 'none', autoplay: false });
  } catch (error) {
    playerPromise = null;
    console.warn('播放器暂时不可用', error);
  }
}

export async function initImages(root, signal) {
  const images = [...root.querySelectorAll('[data-zoomable]')];
  if (!images.length) return;
  const { default: mediumZoom } = await import('medium-zoom');
  if (signal.aborted) return;
  const zoom = mediumZoom(images, { background: 'rgba(0,0,0,.85)', margin: 24 });
  // Close the overlay before Astro captures the outgoing document.
  document.addEventListener('site:before-navigation', () => zoom.close({ immediate: true }), { signal });
  signal.addEventListener('abort', () => { zoom.close({ immediate: true }); zoom.detach(); }, { once: true });
}

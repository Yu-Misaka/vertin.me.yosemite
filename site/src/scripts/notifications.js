import { motionDuration, prefersReducedMotion } from './animations.js';

export function greet(signal) {
  try {
    if (sessionStorage.getItem('mox_greeted')) return;
    sessionStorage.setItem('mox_greeted', '1');
  } catch { return; }
  const hour = new Date().getHours();
  const title = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const container = document.createElement('div');
  container.className = 'mox-notification-container';
  const notification = document.createElement('div');
  notification.className = 'mox-notification';
  notification.setAttribute('role', 'status');
  const content = document.createElement('div');
  content.className = 'mox-content';
  const heading = document.createElement('div');
  heading.className = 'mox-title';
  heading.textContent = title;
  const message = document.createElement('div');
  message.className = 'mox-message';
  message.textContent = `欢迎访问本站。当前时间：${new Date().toLocaleString()}`;
  content.append(heading, message);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mox-close-btn';
  close.setAttribute('aria-label', '关闭通知');
  close.textContent = '×';
  notification.append(content, close);
  container.append(notification);
  document.body.append(container);
  const hide = () => {
    clearTimeout(timer);
    clearTimeout(removal);
    notification.classList.remove('show');
    notification.classList.add('hide');
    removal = setTimeout(() => container.remove(), prefersReducedMotion() ? 0 : motionDuration('--motion-local', 180));
  };
  let removal;
  const timer = setTimeout(hide, 5000);
  const frame = requestAnimationFrame(() => notification.classList.add('show'));
  close.addEventListener('click', hide, { signal });
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    clearTimeout(removal);
    cancelAnimationFrame(frame);
    container.remove();
  }, { once: true });
}

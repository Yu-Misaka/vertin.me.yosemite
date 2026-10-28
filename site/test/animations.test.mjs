import test from 'node:test';
import assert from 'node:assert/strict';
import { enterPage } from '../src/scripts/animations.js';

test('initial animation ignores offscreen cards, releases finished effects and cancels on navigation', async () => {
  globalThis.innerHeight = 800;
  const running = [];
  const card = top => ({
    getBoundingClientRect: () => ({ top, bottom: top + 200 }),
    animate: (_, options) => {
      let finish;
      const animation = { options, cancelled: false, finished: new Promise(resolve => { finish = resolve; }), cancel() { this.cancelled = true; }, finish: () => finish() };
      running.push(animation);
      return animation;
    },
  });
  const dispose = enterPage({ querySelectorAll: () => [card(0), card(400), card(1200)] }, false);
  assert.equal(running.length, 2);
  assert.equal(running[0].options.fill, 'backwards');
  running[0].finish();
  await Promise.resolve();
  assert.equal(running[0].cancelled, true);
  dispose();
  assert.equal(running[1].cancelled, true);
});

test('reduced motion does not hide or animate any content', () => {
  const dispose = enterPage({ querySelectorAll: () => { throw new Error('must not animate'); } }, true);
  assert.doesNotThrow(dispose);
});

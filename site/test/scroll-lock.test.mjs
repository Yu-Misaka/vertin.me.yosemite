import test from 'node:test';
import assert from 'node:assert/strict';
import { lockPageScroll } from '../src/scripts/scroll-lock.mjs';

function page({ width = 1428, lockedWidth = width, padding = 0, inlinePadding = '' } = {}) {
  const html = {
    style: { overflow: '' },
    get clientWidth() { return this.style.overflow === 'hidden' ? 1440 : 1428; }
  };
  const view = {
    scrollX: 0,
    scrollY: 320,
    innerWidth: 1440,
    getComputedStyle: () => ({ paddingRight: body.style.paddingRight || `${padding}px` }),
    scrollTo({ left, top, behavior }) {
      assert.equal(behavior, 'instant');
      this.scrollX = left;
      this.scrollY = top;
    }
  };
  const body = {
    style: { overflow: '', paddingRight: inlinePadding },
    getBoundingClientRect: () => ({
      width: body.style.overflow === 'hidden' ? lockedWidth : width
    })
  };
  const contentWidth = () => body.getBoundingClientRect().width - parseFloat(view.getComputedStyle(body).paddingRight);
  return { documentElement: html, body, defaultView: view, contentWidth };
}

test('a stable gutter is not compensated again when clientWidth grows', () => {
  const doc = page();
  const before = doc.contentWidth();
  const release = lockPageScroll(doc);
  assert.equal(doc.documentElement.clientWidth, 1440);
  assert.equal(doc.contentWidth(), before);
  assert.equal(doc.body.style.paddingRight, '');
  release();
});

test('reclaimed scrollbar space preserves the content width and existing padding', () => {
  for (const gap of [12, 15, 17]) {
    const doc = page({ lockedWidth: 1428 + gap, padding: 8, inlinePadding: '8px' });
    const before = doc.contentWidth();
    const release = lockPageScroll(doc);
    assert.equal(doc.contentWidth(), before);
    release();
    assert.equal(doc.contentWidth(), before);
    assert.equal(doc.body.style.paddingRight, '8px');
  }
});

test('overlay scrollbars preserve stylesheet padding without an inline override', () => {
  const doc = page({ width: 390, padding: 6 });
  const before = doc.contentWidth();
  const release = lockPageScroll(doc);
  assert.equal(doc.contentWidth(), before);
  assert.equal(doc.body.style.paddingRight, '');
  release();
  assert.equal(doc.body.style.paddingRight, '');
});

test('releasing the lock restores the original overflow styles and scroll position', () => {
  const doc = page({ lockedWidth: 1440 });
  doc.documentElement.style.overflow = 'auto';
  doc.body.style.overflow = 'scroll';
  const release = lockPageScroll(doc);
  assert.equal(doc.documentElement.style.overflow, 'hidden');
  assert.equal(doc.body.style.overflow, 'hidden');
  doc.defaultView.scrollY = 100;
  release();
  assert.equal(doc.documentElement.style.overflow, 'auto');
  assert.equal(doc.body.style.overflow, 'scroll');
  assert.equal(doc.body.style.paddingRight, '');
  assert.equal(doc.defaultView.scrollY, 320);
});

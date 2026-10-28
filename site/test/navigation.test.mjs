import test from 'node:test';
import assert from 'node:assert/strict';
import { activeNavigationPath, initNavigation } from '../src/scripts/navigation.js';

const destinations = ['/', '/navigator', '/archives', '/canary', '/anchors', '/curriculum-vitae'];

test('the actual menu route wins over stale parent metadata and trailing slashes', () => {
  assert.equal(activeNavigationPath('/navigator/', '/', destinations), '/navigator');
  assert.equal(activeNavigationPath('/archives//', '/navigator', destinations), '/archives');
  assert.equal(activeNavigationPath('/anchors', undefined, destinations), '/anchors');
});

test('non-menu pages use only a declared menu parent', () => {
  assert.equal(activeNavigationPath('/posts/9/', '/', destinations), '/');
  assert.equal(activeNavigationPath('/page/2/', '/', destinations), '/');
  assert.equal(activeNavigationPath('/search', '/search', destinations), null);
});

test('a persisted header retains exactly one current link across clicks, history and repeated loads', () => {
  const items = destinations.map(path => {
    const attributes = new Map();
    const classes = new Set();
    const link = {
      href: `https://site.example${path}`, attributes,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name),
    };
    return {
      link, classes,
      classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
      querySelector: () => link,
    };
  });
  const page = { dataset: { navCurrent: '/' } };
  const nav = { querySelectorAll: () => items, querySelector: () => null };
  globalThis.document = {
    querySelector: () => nav,
    getElementById: () => page,
  };
  globalThis.location = { pathname: '/' };
  for (const pathname of ['/', '/navigator/', '/archives', '/navigator', '/curriculum-vitae/', '/anchors', '/']) {
    location.pathname = pathname;
    // Deliberately keep stale metadata, as can happen during a router lifecycle.
    initNavigation();
    initNavigation();
    const expected = pathname.replace(/\/+$/, '') || '/';
    assert.deepEqual(items.filter(item => item.link.attributes.get('aria-current') === 'page')
      .map(item => new URL(item.link.href).pathname), [expected]);
    assert.equal(items.filter(item => item.classes.has('nav-item-current')).length, 1);
  }
  location.pathname = '/posts/9/';
  initNavigation();
  assert.equal(items[0].link.attributes.get('aria-current'), 'page');
  location.pathname = '/search';
  page.dataset.navCurrent = '/search';
  initNavigation();
  assert.equal(items.filter(item => item.link.attributes.has('aria-current')).length, 0);
});

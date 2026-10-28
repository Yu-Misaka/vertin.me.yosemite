import test from 'node:test';
import assert from 'node:assert/strict';
import { updateCommentCounts } from '../src/scripts/integrations.js';

test('public comment counts use the HTTP API without importing the widget', async () => {
  globalThis.document = { documentElement: { dataset: { twikooEnv: 'https://comments.example/' } } };
  const link = { href: 'https://site.example/posts/9/#comments', isConnected: true, textContent: '' };
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'https://comments.example/');
    assert.equal(JSON.parse(options.body).event, 'GET_COMMENTS_COUNT');
    assert.deepEqual(JSON.parse(options.body).urls, ['/posts/9/']);
    return { ok: true, json: async () => ({ data: [{ url: '/posts/9/', count: 2 }] }) };
  };
  const signal = new AbortController().signal;
  const root = { querySelectorAll: () => [link] };
  await updateCommentCounts(root, signal);
  assert.equal(link.textContent, ' 2 条评论');
  await updateCommentCounts(root, signal);
  assert.equal(requests, 1, 'reuse counts across navigation');
});

test('late comment responses cannot update an abandoned page', async () => {
  globalThis.document = { documentElement: { dataset: { twikooEnv: 'https://comments.example/' } } };
  const link = { href: 'https://site.example/posts/abandoned/', isConnected: true, textContent: 'original' };
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const controller = new AbortController();
  const pending = updateCommentCounts({ querySelectorAll: () => [link] }, controller.signal);
  controller.abort();
  finish({ ok: true, json: async () => ({ data: [{ url: '/posts/abandoned/', count: 10 }] }) });
  await pending;
  assert.equal(link.textContent, 'original');
});

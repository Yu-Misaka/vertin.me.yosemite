import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fromHtml } from 'hast-util-from-html';
import { visit } from 'unist-util-visit';

const dist = new URL('../dist/', import.meta.url);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (path.endsWith('.html')) files.push(path);
  }
}
await walk(dist.pathname);
assert.ok(files.length > 0, 'build output must exist');
let formulas = 0;
let images = 0;
let tabs = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const tree = fromHtml(html);
  const ids = new Set();
  const assets = [];
  visit(tree, 'element', node => {
    const props = node.properties;
    if (props.id) {
      assert.ok(!ids.has(props.id), `${file}: duplicate id ${props.id}`);
      ids.add(props.id);
    }
    if (props.className?.includes('katex')) formulas++;
    assert.ok(!props.className?.includes('katex-error'), `${file}: invalid formula`);
    if (props.role === 'tab') tabs++;
    if (node.tagName === 'script' && props.src) {
      assert.ok(!props.src.startsWith('/js/'), `${file}: legacy client script`);
      assert.ok(!/katex|auto-render/.test(props.src), `${file}: browser math renderer`);
      if (props.src.startsWith('/')) assets.push(props.src);
    }
    if (node.tagName === 'img') {
      images++;
      assert.ok(!props.dataLazySrc, `${file}: legacy lazy placeholder`);
      assert.ok(!String(props.src).startsWith('data:image/gif'), `${file}: placeholder image`);
      if (String(props.src).startsWith('/') && !String(props.src).startsWith('//')) {
        assert.ok(props.width > 0 && props.height > 0, `${file}: missing image dimensions for ${props.src}`);
      }
    }
  });
  for (const src of assets) await access(new URL('.' + src, dist));
}
await access(new URL('pagefind/pagefind.js', dist));
console.log(`Verified ${files.length} pages, ${formulas} formulas, ${images} images and ${tabs} tabs.`);

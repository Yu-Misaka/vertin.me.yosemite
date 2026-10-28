import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { fromHtml } from 'hast-util-from-html';
import { visit } from 'unist-util-visit';
import remarkGfm from '../src/remark/remark-gfm-no-autolink.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeContent from '../src/rehype/rehype-content.mjs';
import rehypeTables from '../src/rehype/rehype-wrap-tables.mjs';
import { imageMetadata } from '../src/utils/image-metadata.mjs';
import { selectFontFaces } from '../src/integrations/fonts.mjs';

const processor = await createMarkdownProcessor({
  gfm: false,
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeContent, [rehypeKatex, { strict: 'ignore' }], rehypeTables],
});
const render = async source => (await processor.render(source)).code;
const source = async path => (await readFile(new URL(`../src/content/${path}`, import.meta.url), 'utf8')).replace(/^---\n[\s\S]*?\n---\n/, '');
function elements(html, predicate) {
  const nodes = [];
  visit(fromHtml(html, { fragment: true }), 'element', node => { if (predicate(node)) nodes.push(node); });
  return nodes;
}
const hasClass = name => node => node.properties.className?.includes(name);

test('legacy CV tabs retain their timelines and accessible panel relationships', async () => {
  const html = await render(await source('pages/curriculum-vitae.md'));
  const tabs = elements(html, node => node.properties.role === 'tab');
  const panels = elements(html, node => node.properties.role === 'tabpanel');
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  panels.forEach((panel, index) => assert.equal(panel.properties.ariaLabelledBy[0], tabs[index].properties.id));
  assert.equal(elements(html, hasClass('timeline-item')).length, 4);
  assert.match(html, /University of Wisconsin/);
  assert.match(html, /KoszulComplex/);
  assert.doesNotMatch(html, /\[\/?(?:tabs|tab|timeline|timeline-event)\b/);
});

test('adjacent friend cards compile into grids without dropping links', async () => {
  const markdown = await source('pages/navigator.md');
  const html = await render(markdown);
  assert.equal(elements(html, hasClass('friendsboard-item')).length, markdown.match(/\[friend-card /g).length);
  assert.ok(elements(html, hasClass('friendsboard-list')).length >= 4);
  assert.match(html, /foo_input_vgmstream/);
  assert.doesNotMatch(html, /\[friend-card /);
});

test('formulas and shortcodes are rendered together before reaching the browser', async () => {
  const html = await render('[alert type="blue"]题面：$|x|_p=1$[/alert]\n\n$$\n\\sum_{i=0}^n i\n$$');
  assert.equal(elements(html, hasClass('alert-box')).length, 1);
  assert.equal(elements(html, hasClass('katex')).length, 2);
  assert.match(html, /<math/);
  assert.doesNotMatch(html, /katex-error/);
});

test('literal shortcode examples in code are preserved and URLs link only outside code', async () => {
  const html = await render('`[alert type="red"]literal[/alert]`\n\n```text\n[tabs][tab title="x"]literal[/tab][/tabs]\n```\n\nhttps://example.org/path。');
  assert.equal(elements(html, hasClass('alert-box')).length, 0);
  assert.equal(elements(html, hasClass('tab-container')).length, 0);
  assert.equal(elements(html, node => node.tagName === 'a')[0].properties.href, 'https://example.org/path');
  assert.match(html, /literal/);
});

test('formulas inside legacy raw HTML render without processing literal HTML code', async () => {
  const html = await render('<font style="line-height:3;">\n- $[LK^\\prime : K^\\prime] \\geq e$:\n</font>\n\n<pre>$literal$</pre>');
  assert.equal(elements(html, hasClass('katex')).length, 1);
  assert.match(html, /\$literal\$/);
  assert.doesNotMatch(html, /\$\[LK/);
});

test('local Markdown images receive real dimensions and native lazy loading', async () => {
  const html = await render('![caption](/images/avatar.webp)');
  const img = elements(html, node => node.tagName === 'img')[0];
  assert.ok(img.properties.width > 0 && img.properties.height > 0);
  assert.equal(img.properties.loading, 'lazy');
  assert.equal(elements(html, node => node.tagName === 'figcaption').length, 1);
  assert.doesNotMatch(html, /data-lazy-src|data:image/);
  assert.deepEqual(await imageMetadata('/../package.json'), {});
});

test('all shortcode families survive build-time compilation, including collapsed content', async () => {
  const html = await render('[window type="yellow" title="Title"]Body[/window]\n\n[collapsible-panel title="Archive"]\n\n## Preserved heading\n\nText\n\n[/collapsible-panel]\n\n[bilibili-card bvid="BV123"]\n\n[PicGrid]![one](/images/avatar.webp)[/PicGrid]');
  for (const name of ['window', 'collapsible-panel', 'bilibili-card', 'pic-grid']) assert.equal(elements(html, hasClass(name)).length, 1);
  assert.equal(elements(html, hasClass('collapsible-content'))[0].properties.style, undefined,
    'inline max-height must not clamp the measured-height animation');
  assert.match(html, /Preserved heading/);
  assert.equal(elements(html, node => node.tagName === 'iframe')[0].properties.loading, 'lazy');
});

test('font selection keeps only needed shards and retains their full Unicode ranges', () => {
  const css = '@font-face{src:url("./a.woff2");unicode-range:U+20-7F;}@font-face{src:url("./b.woff2");unicode-range:U+4E00-4EFF;}';
  const latin = selectFontFaces(css, 'hello');
  assert.match(latin, /\/fonts\/a.woff2/);
  assert.doesNotMatch(latin, /b.woff2/);
  assert.match(selectFontFaces(css, '一'), /b.woff2/);
});

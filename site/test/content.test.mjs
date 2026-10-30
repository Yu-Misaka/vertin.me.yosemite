import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
function elements(html, predicate) {
  const nodes = [];
  visit(fromHtml(html, { fragment: true }), 'element', node => { if (predicate(node)) nodes.push(node); });
  return nodes;
}
const hasClass = name => node => node.properties.className?.includes(name);

test('legacy tabs retain their timelines and accessible panel relationships', async () => {
  const html = await render(`
[tabs]
[tab title="First timeline"]
[timeline]
[timeline-event date="2024" title="**First event**"]

First event description.

[/timeline-event]
[/timeline]
[/tab]
[tab title="Second timeline"]
[timeline]
[timeline-event date="2025" title="**Second event**"]

[Event details](https://example.org/event)

[/timeline-event]
[/timeline]
[/tab]
[tab title="Notes"]

Plain tab content.

[/tab]
[/tabs]
`);
  const tabs = elements(html, node => node.properties.role === 'tab');
  const panels = elements(html, node => node.properties.role === 'tabpanel');
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  panels.forEach((panel, index) => {
    assert.equal(panel.properties.ariaLabelledBy[0], tabs[index].properties.id);
    assert.equal(tabs[index].properties.ariaControls[0], panel.properties.id);
  });
  assert.equal(elements(html, hasClass('timeline-item')).length, 2);
  assert.match(html, /<strong>First event<\/strong>/);
  assert.match(html, /First event description/);
  assert.match(html, /<strong>Second event<\/strong>/);
  assert.equal(elements(html, node => node.tagName === 'a')[0].properties.href, 'https://example.org/event');
  assert.match(html, /Plain tab content/);
  assert.doesNotMatch(html, /\[\/?(?:tabs|tab|timeline|timeline-event)\b/);
});

test('an italic opening line becomes the timeline subtitle while other emphasis stays inline', async () => {
  const html = await render(`
[timeline]
[timeline-event date="2025" title="**Institution**"]

*Role title*
- Detail with *inline emphasis*.

[/timeline-event]
[timeline-event date="2024" title="**Other**"]

Opens with *mixed* emphasis.

[/timeline-event]
[/timeline]
`);
  const subtitles = elements(html, hasClass('timeline-subtitle'));
  assert.equal(subtitles.length, 1);
  assert.equal(subtitles[0].children[0].tagName, 'em');
  assert.match(html, /<li>Detail with <em>inline emphasis<\/em>\.<\/li>/);
  assert.match(html, /<p>Opens with <em>mixed<\/em> emphasis\.<\/p>/);
});

test('adjacent friend cards compile into grids without dropping links', async () => {
  const html = await render(`
## First group
[friend-card name="First friend" ico="/images/avatar.webp" url="https://example.org/first"]First description.[/friend-card]
[friend-card name="Second friend" ico="/images/avatar.webp" url="https://example.org/second"]See the [guide](https://example.org/guide).[/friend-card]

## Second group
[friend-card name="Third friend" ico="/images/avatar.webp" url="https://example.org/third"]Third description.[/friend-card]
`);
  assert.equal(elements(html, hasClass('friendsboard-item')).length, 3);
  assert.equal(elements(html, hasClass('friendsboard-list')).length, 2);
  const links = elements(html, node => node.tagName === 'a').map(node => node.properties.href);
  for (const path of ['first', 'second', 'third', 'guide']) assert.ok(links.includes(`https://example.org/${path}`));
  assert.doesNotMatch(html, /\[friend-card /);
});

test('formulas and shortcodes are rendered together before reaching the browser', async () => {
  const html = await render('[alert type="blue"]题面：$|x|_p=1$[/alert]\n\n$$\n\\sum_{i=0}^n i\n$$');
  assert.equal(elements(html, hasClass('alert-box')).length, 1);
  assert.equal(elements(html, hasClass('katex')).length, 2);
  assert.match(html, /<math/);
  assert.doesNotMatch(html, /katex-error/);
});

test('formula markup and the bundled KaTeX stylesheet come from the same release', () => {
  // KaTeX renames layout classes between minor versions; a split leaves subscripts and \neq unstyled.
  const version = from => createRequire(from)('katex/package.json').version;
  assert.equal(version(import.meta.resolve('rehype-katex')), version(import.meta.url));
});

test('literal shortcode examples in code are preserved and URLs link only outside code', async () => {
  const html = await render('`[alert type="red"]literal[/alert]`\n\n```text\n[tabs][tab title="x"]literal[/tab][/tabs]\n```\n\nhttps://example.org/path。\n\n见https://example.org/archives/395的心路历程');
  assert.equal(elements(html, hasClass('alert-box')).length, 0);
  assert.equal(elements(html, hasClass('tab-container')).length, 0);
  const links = elements(html, node => node.tagName === 'a');
  assert.equal(links[0].properties.href, 'https://example.org/path');
  assert.equal(links[1].properties.href, 'https://example.org/archives/395', 'Chinese prose is not part of a bare URL');
  assert.match(html, /<\/a>的心路历程/);
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

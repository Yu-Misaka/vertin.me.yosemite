import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { visit } from 'unist-util-visit';
import { compileShortcodes } from './shortcodes.mjs';
import { imageMetadata } from '../utils/image-metadata.mjs';
import { renderRawMath } from './raw-math.mjs';

const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const classes = node => node.properties?.className ?? [];

function decorate(parent, inFigure = false, inLink = false) {
  if (!parent.children) return;
  const next = [];
  for (const node of parent.children) {
    if (node.type === 'element') {
      const isFigure = inFigure || node.tagName === 'figure';
      const isLink = inLink || classes(node).includes('katex') || ['a', 'code', 'pre', 'script', 'style', 'kbd', 'samp', 'math'].includes(node.tagName);
      decorate(node, isFigure, isLink);
      if (node.tagName === 'p' && node.children.every(child => child.type === 'text' && !child.value.trim())) continue;
      if (node.tagName === 'img') {
        const excluded = classes(node).includes('friends-card-avatar');
        node.properties.loading ??= 'lazy';
        node.properties.decoding ??= 'async';
        if (!excluded && !classes(node).includes('no-zoom') && node.properties.id !== 'no-zoom') {
          node.properties.dataZoomable = '';
        }
        if (!excluded && !inFigure && !classes(node).includes('no-figcaption') && node.properties.alt) {
          next.push(element('figure', {}, [node, element('figcaption', {}, [{ type: 'text', value: node.properties.alt }])]));
          continue;
        }
      }
      // A figure or shortcode is a block, never a child of a paragraph.
      if (node.tagName === 'p' && node.children.some(child => child.tagName === 'figure')) {
        next.push(...node.children);
        continue;
      }
    }
    if (node.type === 'text' && !inLink && /https?:\/\//.test(node.value)) {
      let end = 0;
      for (const match of node.value.matchAll(/https?:\/\/[^\s<>]+/g)) {
        const url = match[0].replace(/[)\].,!?:;，。！？；：、”’》】）]+$/, '');
        if (match.index > end) next.push({ type: 'text', value: node.value.slice(end, match.index) });
        next.push(element('a', { href: url }, [{ type: 'text', value: url }]));
        end = match.index + url.length;
      }
      if (end < node.value.length) next.push({ type: 'text', value: node.value.slice(end) });
    } else next.push(node);
  }
  // Consecutive friend cards share a responsive grid (ignoring whitespace).
  parent.children = [];
  let group;
  for (const node of next) {
    if (classes(node).includes('friendsboard-item')) {
      if (!group) {
        group = element('div', { className: ['friendsboard-list'] });
        parent.children.push(group);
      }
      group.children.push(node);
    } else if (group && (node.type === 'comment' || (node.type === 'text' && !node.value.trim()))) {
      continue;
    } else {
      group = null;
      parent.children.push(node);
    }
  }
}

export default function rehypeContent() {
  return async tree => {
    visit(tree, 'raw', node => { node.value = renderRawMath(node.value); });
    const html = compileShortcodes(toHtml(tree, { allowDangerousHtml: true }));
    const compiled = fromHtml(html, { fragment: true });
    decorate(compiled);
    const images = [];
    visit(compiled, 'element', node => {
      if (node.tagName === 'img') images.push(node);
    });
    await Promise.all(images.map(async node => {
      const { width, height } = await imageMetadata(node.properties.src);
      node.properties.width ??= width;
      node.properties.height ??= height;
    }));
    tree.children = compiled.children;
  };
}

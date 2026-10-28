import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { visit } from 'unist-util-visit';
import { imageMetadata } from './image-metadata.mjs';

export async function imageMarkup(html) {
  const tree = fromHtml(html, { fragment: true });
  const images = [];
  visit(tree, 'element', node => { if (node.tagName === 'img') images.push(node); });
  await Promise.all(images.map(async node => {
    const { width, height } = await imageMetadata(node.properties.src);
    node.properties.width ??= width;
    node.properties.height ??= height;
    node.properties.decoding ??= 'async';
  }));
  return toHtml(tree);
}

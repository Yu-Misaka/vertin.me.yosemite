import katex from 'katex';

// remark-math intentionally skips raw HTML blocks. Older articles contain
// formulas inside <font>/<div>; compile those too, without touching attributes,
// scripts or literal code examples. Normal Markdown math uses rehype-katex.
export function renderRawMath(html) {
  const protectedBlocks = [];
  html = html.replace(/<(pre|code|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, block => {
    return `<!--ps-raw-math-${protectedBlocks.push(block) - 1}-->`;
  });
  html = html.split(/(<\/?[a-z][^>]*>|<!--[\s\S]*?-->)/gi).map((part, index) => {
    if (index % 2) return part;
    return part.replace(/(?<!\\)(\$\$|\$)(?!\$)([\s\S]+?)(?<!\\)\1(?!\$)/g, (_, delimiter, math) => {
      const decoded = math.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]);
      return katex.renderToString(decoded, { displayMode: delimiter === '$$', throwOnError: false, strict: 'ignore', trust: false });
    });
  }).join('');
  return html.replace(/<!--ps-raw-math-(\d+)-->/g, (_, index) => protectedBlocks[Number(index)]);
}

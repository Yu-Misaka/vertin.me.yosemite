import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export function selectFontFaces(css, corpus) {
  const points = [...new Set([...corpus].map(char => char.codePointAt(0)))];
  const faces = css.match(/@font-face\{[^}]+}/g) ?? [];
  return faces.filter(face => {
    const ranges = face.match(/unicode-range:([^;]+)/)?.[1].split(',') ?? [];
    return ranges.some(range => {
      const [start, end = start] = range.replace('U+', '').split('-').map(hex => parseInt(hex, 16));
      return points.some(point => point >= start && point <= end);
    });
  }).join('\n').replaceAll('url("./', 'url("/fonts/');
}

// Keep the original font split and license intact. Ship only shards referenced
// by the site's content/UI; new Markdown automatically adds its required shards.
export default function siteFonts() {
  const id = 'virtual:site-fonts.css';
  const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
  const fontSource = fileURLToPath(new URL('../../public/fonts/result.css', import.meta.url));
  return {
    name: 'site-fonts',
    resolveId(source) { if (source === id) return '\0' + id; },
    load(source) {
      if (source !== '\0' + id) return;
      let corpus = Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)).join('');
      const read = dir => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) read(path);
          else if (/\.(md|astro|js|ts)$/.test(path)) {
            this.addWatchFile(path);
            corpus += readFileSync(path, 'utf8');
          }
        }
      };
      read(sourceRoot);
      this.addWatchFile(fontSource);
      const css = readFileSync(fontSource, 'utf8');
      return css.slice(0, css.indexOf('@font-face')) + selectFontFaces(css, corpus);
    },
  };
}

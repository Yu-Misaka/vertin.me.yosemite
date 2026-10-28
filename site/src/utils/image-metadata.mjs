import { resolve, sep } from 'node:path';
import sharp from 'sharp';

const publicRoot = resolve(process.cwd(), 'public');
const cache = new Map();

/** Read local image dimensions once per build; never fetch remote content. */
export function imageMetadata(src) {
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return Promise.resolve({});
  if (!cache.has(src)) {
    cache.set(src, (async () => {
      try {
        const path = resolve(publicRoot, decodeURIComponent(src.split(/[?#]/)[0]).slice(1));
        if (!path.startsWith(publicRoot + sep)) return {};
        const metadata = await sharp(path).metadata();
        const rotated = [5, 6, 7, 8].includes(metadata.orientation);
        return {
          width: rotated ? metadata.height : metadata.width,
          height: rotated ? metadata.width : metadata.height,
        };
      } catch {
        return {};
      }
    })());
  }
  return cache.get(src);
}

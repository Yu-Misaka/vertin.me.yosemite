import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkGfmNoAutolink from "./src/remark/remark-gfm-no-autolink.mjs";
import rehypeWrapTables from "./src/rehype/rehype-wrap-tables.mjs";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeContent from './src/rehype/rehype-content.mjs';
import siteFonts from './src/integrations/fonts.mjs';

// Astro keeps rendered Markdown while an entry's text is unchanged; plugin code
// is not part of that cache key, only plugin options are. Passing a digest of
// the pipeline as an (unused) option makes a changed shortcode, plugin or
// dependency re-render every entry instead of serving stale markup. Node keeps
// plugin modules loaded, so in dev the change applies after restarting the server.
const pipelineFiles = ['src/remark', 'src/rehype']
  .flatMap(dir => readdirSync(new URL(`./${dir}/`, import.meta.url)).sort().map(name => `${dir}/${name}`))
  .concat('src/utils/image-metadata.mjs', 'package-lock.json');

function pipelineDigest() {
  const hash = createHash('sha256');
  for (const file of pipelineFiles) hash.update(file).update(readFileSync(new URL(`./${file}`, import.meta.url)));
  return hash.digest('hex').slice(0, 16);
}

export default defineConfig({
  vite: { plugins: [siteFonts()] },
  output: "static",
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  markdown: {
    processor: unified({
      gfm: false,
      remarkPlugins: [remarkGfmNoAutolink, remarkMath],
      rehypePlugins: [[rehypeContent, { pipeline: pipelineDigest() }], [rehypeKatex, { strict: 'ignore', throwOnError: false }], rehypeWrapTables],
    }),
    shikiConfig: {
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark"
      }
    }
  }
});

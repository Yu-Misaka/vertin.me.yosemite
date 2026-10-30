import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkGfmNoAutolink from "./src/remark/remark-gfm-no-autolink.mjs";
import rehypeWrapTables from "./src/rehype/rehype-wrap-tables.mjs";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeContent from './src/rehype/rehype-content.mjs';
import siteFonts from './src/integrations/fonts.mjs';

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
      rehypePlugins: [rehypeContent, [rehypeKatex, { strict: 'ignore', throwOnError: false }], rehypeWrapTables],
    }),
    shikiConfig: {
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark"
      }
    }
  }
});

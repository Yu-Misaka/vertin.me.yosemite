import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import remarkGfmNoAutolink from "./src/remark/remark-gfm-no-autolink.mjs";
import rehypeWrapTables from "./src/rehype/rehype-wrap-tables.mjs";

export default defineConfig({
  integrations: [vue()],
  output: "static",
  markdown: {
    gfm: false,
    remarkPlugins: [remarkGfmNoAutolink],
    rehypePlugins: [rehypeWrapTables],
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark"
      }
    }
  }
});

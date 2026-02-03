import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import viewTransitions from "@astrojs/view-transitions";

export default defineConfig({
  integrations: [vue(), viewTransitions()],
  output: "static"
});

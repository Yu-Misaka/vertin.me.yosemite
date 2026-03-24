# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog built with Astro 5, Vue 3, and the "PureSuck" theme. Content is in Chinese. The Astro project lives inside the `site/` directory.

## Commands

All commands run from the `site/` directory:

```bash
cd site
npm run dev        # Dev server at localhost:4321
npm run build      # Build static site + Pagefind search index (postbuild)
npm run preview    # Preview production build
npx astro sync     # Sync content collection types
npx tsc --noEmit   # TypeScript check (used in CI)
```

## Architecture

**Content Collections** (`site/src/content/`): Two Zod-validated collections — `posts` (blog entries) and `pages` (standalone pages). Posts use frontmatter fields: `title`, `date`, `tags`, `category`, `cover`, `draft`, etc. Pages merge into navigation via `order` field.

**Routing**: Astro static generation with `getStaticPaths()`. Key dynamic routes:
- `posts/[slug].astro` — individual posts
- `[slug].astro` — standalone pages
- `page/[page].astro`, `tags/[tag].astro`, `categories/[category].astro` — listing pages

**Site Config** (`site/src/config/site.ts`): Central configuration for title, navigation, pagination, comments (Twikoo), music (APlayer), theme color, and feature toggles. Theme color tokens are in `site/src/config/theme.ts` (8 color options with light/dark variants).

**Markdown Pipeline**: Custom remark plugin for GFM without autolinks (`site/src/remark/`), custom rehype plugin for table wrapping (`site/src/rehype/`). Shortcodes (alerts, windows, friend cards, tabs, timelines, etc.) are processed client-side by `public/js/PureSuck_Shortcodes.js`.

**Client-side JS** (`site/public/js/`): Theme logic in `PureSuck_Module.js`, lazy loading in `PureSuck_LazyLoad.js`, UI components in `MoxDesign.js`. These are vanilla JS, not bundled through Vite.

**View Transitions**: Astro View Transitions API is active. APlayer persists across transitions via `transition:persist`. Medium-zoom and lazy loading require reinitialization after transitions.

**Search**: Pagefind generates a static search index during postbuild. Content is marked with `data-pagefind-body` and `data-pagefind-meta` attributes.

## CI

GitHub Actions (`.github/workflows/ci.yml`): Node 20, runs `npm ci` → `astro sync` → `tsc --noEmit` → `npm run build` from `site/`.

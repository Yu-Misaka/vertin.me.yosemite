## 环境要求

- Node.js：由当前依赖的 Astro 版本决定，建议使用 `^18.17.1 || ^20.3.0 || >=21`（见 `node_modules/astro/package.json` 的 `engines.node`）
- 包管理器：本项目带有 `package-lock.json`，默认使用 `npm`

## 快速开始

在项目根目录下执行：

```bash
cd site
npm install
npm run dev
```

开发服务器启动后，默认访问：`http://localhost:4321/`

## 构建与预览

```bash
cd site
npm run build
npm run preview
```

- `npm run build` = `astro build` +（postbuild）`pagefind --site dist`
- 构建产物在 `site/dist/`，可直接部署到任意静态托管（Nginx / GitHub Pages / Cloudflare Pages / OSS 等）

## 内容组织

### 文章（Posts）

路径：`site/src/content/posts/*.md`

Frontmatter 字段（见 `site/src/content/config.ts`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | 是 | 标题 |
| `description` | `string` | 否 | 摘要；不填会从正文自动截取 |
| `date` | `date` | 是 | 发布时间 |
| `updated` | `date` | 否 | 更新时间（当前主题未单独展示，但可用于扩展） |
| `tags` | `string[]` | 否 | 标签数组（默认 `[]`） |
| `category` | `string` | 否 | 分类 |
| `cover` | `string` | 否 | 头图 URL（可用站内 `/images/...` 或外链） |
| `draft` | `boolean` | 否 | 草稿（默认 `false`）；草稿不会被构建到页面里 |

示例：

```md
---
title: "Hello Astro"
description: "这是一篇示例文章"
date: 2026-02-04
tags: ["网站", "Astro"]
category: "IT"
cover: "/images/avatar.webp"
draft: false
---
正文内容...
```

文章路由：`/posts/<slug>/`（`slug` 为文件名，例如 `hello-world.md` → `hello-world`）

### 页面（Pages）

路径：`site/src/content/pages/*.md`

Frontmatter 字段（见 `site/src/content/config.ts`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | 是 | 标题 |
| `description` | `string` | 否 | 描述 |
| `date` | `date` | 否 | 日期 |
| `cover` | `string` | 否 | 头图 URL |
| `order` | `number` | 否 | 导航排序（越小越靠前） |

页面路由：`/<slug>/`

导航栏生成逻辑在 `site/src/components/Header.astro`：

- 先使用 `site/src/config/site.ts` 里的 `site.navItems`
- 再把 `src/content/pages` 里的页面按 `order` 合并进去（若 `href` 不重复）

## 站点配置

主要配置文件：`site/src/config/site.ts`

常用项：

- 基本信息：`site.title` / `site.description` / `site.author`
- 首页分页：`site.postsPerPage`
- 侧边栏开关：`site.show.search / toc / tag / category / cardCategory / wordCount / copyright`
- 主题色：`site.themeColor`（对应 `site/src/config/theme.ts` 的配色表）
- 标题装饰线：`site.postTitleAfter`（`off | boldLine | wavyLine`）
- 页脚文案：`site.footerInfo`（HTML 字符串，会直接插入页面）
- 自定义注入：`site.leftSideCustomCode`、`site.footerScript`（都是 HTML 字符串）

## 搜索（Pagefind）

搜索页：`/search`

- Pagefind 索引由 `npm run build` 的 `postbuild` 自动生成（输出到 `dist/pagefind/`）
- 在 `npm run dev` 下如果提示“搜索索引尚未生成，请先运行 build”，属于正常现象

## 评论（Twikoo）

评论组件：`site/src/components/Comments.astro`

- 目前仅支持 Twikoo
- 在 `site/src/config/site.ts` 中设置：
  - `site.comments.provider = "twikoo"`
  - `site.comments.envId = "<你的 Twikoo 地址或环境 ID>"`
- 如果 `envId` 为空，会显示“评论区已关闭”

## 数学公式（KaTeX）

已在 `site/src/layouts/BaseLayout.astro` 中引入 KaTeX（auto-render）。

- 行内：`$ ... $`
- 块级：`$$ ... $$`

## 主题短代码（Shortcodes）

短代码由 `site/public/js/PureSuck_Shortcodes.js` 在前端渲染，写在 Markdown 正文中即可使用（区分大小写）：

- 提示框：`[alert type="red"]内容[/alert]`（`green/blue/yellow/red`）
- 窗口：`[window type="..." title="..."]内容[/window]`
- 友链卡片：`[friend-card name="..." ico="..." url="..."]描述[/friend-card]`
- 折叠面板：`[collapsible-panel title="..."]内容[/collapsible-panel]`
- 时间线：
  - `[timeline] ... [/timeline]`
  - `[timeline-event date="YYYY-MM-DD" title="标题"]内容[/timeline-event]`
- Tabs：
  - `[tabs] ... [/tabs]`
  - `[tab title="标题"]内容[/tab]`
- B 站卡片：`[bilibili-card bvid="BV..."]`
- 图片网格：`[PicGrid]...[/PicGrid]`

## 部署

1. 本地构建：`cd site && npm run build`
2. 部署 `site/dist/` 目录到静态服务器即可

如果你用的是带“SPA 回退”的托管（例如某些 CDN 默认把 404 重写到 `index.html`），建议确保静态文件与目录路由都能正确访问（本项目包含 `404.astro`）。


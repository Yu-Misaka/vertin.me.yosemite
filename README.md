> [!WARNING]
> 这是一个自用项目，代码全部由codex从[PureSuck-theme](https://github.com/MoXiaoXi233/PureSuck-theme)迁移，请优先查看部署原作者的主题。

开发服务器启动后，默认访问：`http://localhost:4321/`

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


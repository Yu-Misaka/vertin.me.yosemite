> [!WARNING]
> 这是一个自用项目，代码全部由codex从[PureSuck-theme](https://github.com/MoXiaoXi233/PureSuck-theme)迁移，请优先查看部署原作者的主题。

开发服务器启动后，默认访问：`http://localhost:4321/`

## 内容组织

### 文章（Posts）

路径：`site/src/content/posts/*.md`

Frontmatter 字段（见 `site/src/content.config.ts`）：

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

Frontmatter 字段（见 `site/src/content.config.ts`）：

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

公式通过 remark-math / rehype-katex 在构建时渲染，页面切换无需刷新，也不再下载浏览器端公式渲染脚本。

- 行内：`$ ... $`
- 块级：`$$ ... $$`

## 主题短代码（Shortcodes）

短代码由 `site/src/rehype/rehype-content.mjs` 在构建时编译，现有 Markdown 写法保持兼容。代码块中的短代码示例不会被转换：

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


## 客户端架构与验证

- `site/src/scripts/app.js` 是唯一页面生命周期入口。每次页面替换后初始化一次，离开时通过 AbortController 清理监听器、观察器及异步工作。
- `site/src/scripts/animations.js` 只负责首屏轻量入场与封面共享元素；后续导航由 Astro 原生 View Transitions 完成。过渡不会隐藏正文或改变文章高度，减少动态效果模式下直接切换。
- 交互按职责拆分为 `theme`、`navigation`、`toc`、`widgets`、`search` 与 `integrations`。客户端代码和主要 CSS 经 Vite 打包、压缩及缓存；搜索只在搜索页加载。
- 正文短代码、公式、图注、图片尺寸及 URL 链接均在构建时生成。图片使用原生懒加载，首屏封面优先加载。
- 播放器在空闲时加载，音频点击播放后才下载，并在导航间保留。评论组件接近视口才加载，HTTP 评论数查询不加载评论 UI；Twikoo 客户端固定为与现有服务兼容的 1.6.44，以同站静态资源原样加载，避免旧 Vue UMD 库再次打包的兼容问题。其注入样式会在导航间保留。
- 字体构建插件从现有字体分片中选择源码和文章需要的字符范围，新增内容会自动更新。未覆盖的评论生僻字使用系统字体回退；原始字体及许可保留在 `site/public/fonts/`。

使用 Node.js 22.23.4 或更高版本（CI 使用 Node 24），在 `site/` 目录运行：

```bash
npm ci
npm run check
npm test
npm run build
npm run verify:build
npm run preview
```

`verify:build` 检查全部生成页中的重复 ID、公式、图片尺寸、旧脚本引用和搜索索引。CI 同样运行回归测试和构建产物验证。

浏览器回归重点：首页进入长文章、目录跳转、返回列表、连续切换导航、浏览器前进后退、简历 Tabs（含方向键）、文章折叠、搜索、图片缩放、评论区，以及移动端和减少动态效果设置。性能变化应在同一浏览器、设备和网络条件下通过 Performance 轨迹比较；构建大小不代表实际帧率。

### 本轮验证记录（2026-10-28）

- Astro 更新至 5.18.2，Vite 更新至 6.4.5（锁文件）；清理未使用的 Vue 集成和旧客户端实现。
- 12 项回归测试、TypeScript、静态构建、Pagefind 和全部生成页验证通过：27 页、120 个预渲染公式、210 张图片、5 个 Tabs 标签。
- 字体声明从 228,654 字节减至 42,791 字节（约 81%）；这是资源体积比较，不是帧率测量。
- 浏览器检查覆盖连续鼠标导航、前进后退、搜索、长文目录、Tabs、折叠、图片缩放、评论跨页复用，以及 390px 手机视口。最终评论组件跨页回归无警告或错误。
- 兼容范围依赖更新后，npm audit 仍有 9 项历史告警（5 low、3 high、1 critical），部分修复涉及跨主版本迁移。本轮保留 Astro 5 静态生成架构，未执行强制跨版本修复；这些告警尚未清零。后续依赖维护应结合上游公告评估，而不能将静态部署视为告警已经解决。

### 依赖升级（2026-10-28）

- Astro 7、Vite 8 和新版内容集合 API；保留 unified Markdown 处理链与既有 HTML 空白处理。
- Twikoo 保持 1.6.44，以维持现有评论服务兼容。

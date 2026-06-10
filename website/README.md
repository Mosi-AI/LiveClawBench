# LiveClawBench Website

LiveClawBench 官网前端项目，用于展示 LLM Agent benchmark 的项目信息、任务详情、排行榜和数据分布。基于 Astro + TypeScript + React Islands + Tailwind CSS 构建，部署在 GitHub Pages。

## 技术栈

| 技术 | 说明 |
|------|------|
| **Astro** | 静态优先的内容网站框架，零 JS 默认输出，SEO 友好 |
| **TypeScript** | 类型安全，提升代码可维护性 |
| **React Islands** | 交互组件按需水合，只在需要时加载 JS |
| **Tailwind CSS** | 原子化 CSS，快速构建一致的 UI |
| **GitHub Pages** | 静态托管，通过 GitHub Actions 自动部署 |

## 项目结构

```
LiveClawBench/
├── astro.config.mjs              # Astro 配置（站点、集成、构建选项）
├── tailwind.config.mjs            # Tailwind CSS 配置（主题、颜色、插件）
├── postcss.config.js              # PostCSS 配置
├── tsconfig.json                  # TypeScript 配置
├── package.json                   # 项目依赖与脚本
│
├── src/                           # 源代码
│   ├── pages/                     # 页面路由（基于文件的路由）
│   │   ├── index.astro            #   首页
│   │   ├── leaderboard.astro      #   排行榜
│   │   ├── tasks/                 #   Task Browser
│   │   │   ├── index.astro       #     任务列表页
│   │   │   └── [name].astro       #     任务详情页（动态路由）
│   │   ├── _mocks_disabled/       #   ⚠️ 暂时下线：原 /mocks 路由（重命名为下划线前缀以离开 Astro 路由表）
│   │   │   ├── index.astro       #     Mock App 列表页
│   │   │   └── [id].astro        #     Mock App 详情页（动态路由）
│   │   └── blogs/                 #   Blog
│   │       ├── index.astro        #     文章列表页
│   │       └── [slug].astro       #     文章详情页（动态路由）
│   │
│   ├── components/                # UI 组件
│   │   ├── common/                #   通用组件（Header、Footer、Button、Card）
│   │   ├── home/                  #   首页组件（Hero、Abstract、DataStatistics）
│   │   ├── leaderboard/           #   排行榜组件（LeaderboardTable）
│   │   ├── tasks/                 #   Task 组件（TaskList、TaskFilter、TaskCard）
│   │   ├── mocks/                 #   Mock App 组件（PreviewGallery、HotspotImage，随 /mocks 一同下线但保留源码）
│   │   └── blog/                  #   Blog 组件（BlogList、BlogPost）
│   │
│   ├── layouts/                   # 布局组件
│   │   ├── BaseLayout.astro       #   基础布局（HTML 结构、Head、全局样式）
│   │   ├── PageLayout.astro       #   标准页面布局（Header + Content + Footer）
│   │   └── BlogLayout.astro       #   Blog 文章布局
│   │
│   ├── content/                   # MDX 内容集合
│   │   ├── config.ts              #   Content Collections schema 定义
│   │   └── blog/                  #   Blog MDX 文章
│   │
│   ├── data/                      # 数据层
│   │   ├── types.ts              #   TypeScript 类型定义
│   │   ├── tasks.ts              #   Task 数据读取函数
│   │   ├── leaderboard.ts        #   Leaderboard 数据读取函数
│   │   ├── mocks.ts              #   Mock App 数据读取函数
│   │   ├── representative-cases.ts # 代表性案例数据读取
│   │   └── site-config.ts        #   站点配置读取
│   │
│   └── styles/
│       └── global.css             # 全局样式（Tailwind 指令 + 自定义组件样式）
│
├── scripts/                       # 数据生成脚本
│   ├── update_site_data.sh        #   主流程：tasks/leaderboard/diagrams 全量刷新
│   ├── generate_site_data.py      #   从 worktree 生成 tasks.json/domains.toml/mock-apps.json
│   ├── generate_leaderboard.py    #   从 analysis_outputs 生成 leaderboard.json
│   ├── generate-trajectory.mjs    #   从 HuggingFace 拉取轨迹数据并生成分布/任务结果
│   └── fetch-data.ps1             #   PowerShell 脚本：从 HuggingFace 下载 raw-rows.json
│
├── site-content/                  # 项目方维护的内容（手工编辑）
│   ├── site-config.json           #   站点配置（标题、统计数字、链接）
│   └── blog/                      #   Blog Markdown 文章
│
├── site-data/                     # 脚本生成的数据（勿手工编辑）
│   ├── tasks.json                 #   任务数据
│   ├── leaderboard.json           #   排行榜数据
│   ├── trajectory-distribution.json # 轨迹分布数据
│   ├── task-results.json          #   任务结果数据（由 generate_leaderboard.py 生成）
│   ├── raw-rows.json              #   原始轨迹行数据（由 fetch-data.ps1 生成）
│   ├── mock-apps.json             #   Mock App 数据
│   ├── representative-cases.json #   代表性案例数据
│   └── domains.toml               #   领域定义
│
├── public/                        # 静态资源（原样复制到构建输出）
│   ├── favicon.svg                #   网站图标
│   ├── diagrams/                  #   架构图
│   └── mock-previews/             #   Mock App 截图/录屏
│
└── .github/
    └── workflows/
        └── deploy-website.yml     # GitHub Actions 部署工作流
```

## 页面路由

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | 项目介绍、导航入口、数据概览 |
| 排行榜 | `/leaderboard` | 模型排名、筛选、排序 |
| Task 列表 | `/tasks` | 任务浏览器列表 |
| Task 详情 | `/tasks/[name]` | 单个任务详情 |
| Blog 列表 | `/blogs` | 文章列表 |
| Blog 详情 | `/blogs/[slug]` | 文章详情 |

> Mock App Explorer (`/mocks` 及 `/mocks/[id]`) 当前已暂时下线，源文件保留在 `src/pages/_mocks_disabled/` 下方便日后恢复。

## 构建与部署

### 环境要求

- **Node.js** >= 20
- **npm** >= 10
- **PowerShell**（`pwsh`，用于从 HuggingFace 拉取数据）

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

开发服务器默认启动在 `http://localhost:4321`。

### 数据生成

网站数据由脚本从本地 worktree 和 HuggingFace 生成到 `site-data/` 目录。

```bash
# 主流程：从当前 worktree + traj_validation/analysis_outputs 刷新
# tasks.json / domains.toml / mock-apps.json / leaderboard.json / task-results.json
# 以及 public/diagrams/ 下的分析图。无需网络。
bash scripts/update_site_data.sh

# 也可单独跑（高级用法）
python scripts/generate_site_data.py --worktree <PATH> --output site-data
python scripts/generate_leaderboard.py --analysis-root <PATH> --output site-data/leaderboard.json

# 从 HuggingFace 拉取真实轨迹数据（trajectory-distribution.json / task-results.json）
node scripts/generate-trajectory.mjs
node scripts/generate-trajectory.mjs --skip-fetch  # 仅处理已有 raw-rows.json
```

> **注意**：
> - `site-data/` 目录下的文件由脚本自动生成，请勿手工编辑。如需修改内容，请编辑 `site-content/` 下的源文件后重新运行生成脚本。
> - `update_site_data.sh` 默认从当前 worktree (`REPO_ROOT`) 读取任务数据；如果 worktree 中没有 `traj_validation/analysis_outputs`，会自动回落到 primary checkout。可通过 `WORKTREE=` / `ANALYSIS_ROOT=` 环境变量覆盖。
> - `generate-trajectory.mjs` 先执行 `fetch-data.ps1` 从 HuggingFace 下载 `raw-rows.json`，然后处理生成 `trajectory-distribution.json` 和 `task-results.json`。使用 `--skip-fetch` 可跳过下载步骤。Leaderboard 由 `generate_leaderboard.py` 独立维护，该脚本不再覆盖它。

### 部署流程

项目通过 GitHub Actions 自动部署到 GitHub Pages：

1. 代码推送到 `main` 分支触发自动部署
2. 也可在 GitHub Actions 页面手动触发（`workflow_dispatch`）

部署流程：
```
push to main → GitHub Actions 触发 → npm ci → npm run build → 上传 dist/ → 部署到 GitHub Pages
```

站点地址：`https://mosi-ai.github.io/LiveClawBench`（如使用自定义域名则直接访问域名根路径）

### Astro 配置说明

```javascript
// astro.config.mjs 关键配置
{
  site: 'https://mosi-ai.github.io',  // 站点域名
  integrations: [react(), mdx(), tailwind()],
  vite: {
    ssr: { noExternal: ['@tanstack/react-table'] }  // SSR 兼容
  }
}
```

> **注意**：如部署到 GitHub Pages 项目页（`https://<org>.github.io/<repo>/`），需在 `astro.config.mjs` 中添加 `base: '/<repo>'` 配置。使用自定义域名时无需 `base` 配置。

## 数据维护

### 更新 Task 数据

在当前 worktree 的 `tasks/` 或 `docs/metadata/cases_registry*.csv` 更新后，重新生成 site-data：

```bash
bash scripts/update_site_data.sh
```

### 更新 Leaderboard / 轨迹数据

Leaderboard 由 `update_site_data.sh` 从 `traj_validation/analysis_outputs/` 生成。如果要刷新 HuggingFace 上的真实轨迹数据：

```bash
node scripts/generate-trajectory.mjs
```

如已有 `raw-rows.json`，可跳过下载直接处理：

```bash
node scripts/generate-trajectory.mjs --skip-fetch
```

### 新增 Blog 文章

在 `site-content/blog/` 中新增 `.mdx` 文件，包含 frontmatter：

```mdx
---
title: 文章标题
date: 2026-05-18
author: 作者
tags: [标签1, 标签2]
summary: 文章摘要
---

文章内容...
```

### 补充 Mock App 截图

1. 将截图放入 `public/mock-previews/<mock-id>/`
2. 重新运行 `bash scripts/update_site_data.sh` 刷新 `mock-apps.json`

## 使用流程

1. 补充数据
     - [ ] 在当前 worktree 中更新 `tasks/`、`docs/metadata/cases_registry*.csv`
     - [ ] 网站首页展示信息，修改`site-content/site-config.json`文件内容
     - [ ] mock app截图
     - [ ] blog 内容 
2. 执行 `bash scripts/update_site_data.sh`（从 worktree + traj_validation/analysis_outputs 生成 tasks/leaderboard/diagrams）。如需刷新 HuggingFace 轨迹数据，另跑 `node scripts/generate-trajectory.mjs`。
3. dev环境开发：`npm install;npm run dev`
4. 生产环境预览：`npm run build;npm run preview`
5. Deploy to GitHub Pages `.github/workflows/deploy-website.yml`


## 开发规范

- **Astro 组件**：PascalCase.astro（如 `TaskCard.astro`）
- **React 组件**：PascalCase.tsx（如 `LeaderboardTable.tsx`）
- **工具函数**：camelCase.ts（如 `formatDate.ts`）
- **页面路由**：kebab-case.astro / [param].astro
- **Commit 规范**：遵循 [Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `docs:` 等）
- **交互组件**使用 React + `client:*` 指令按需水合，静态内容使用 Astro 组件（零 JS）

## 相关文档

- [Astro 官方文档](https://docs.astro.build/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [TanStack Table 文档](https://tanstack.com/table)
```


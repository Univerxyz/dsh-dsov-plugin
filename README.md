# dsh-dsov-plugin

**DSH Web GUI 插件**：右侧侧边栏新增首位【概览】标签（当前会话实时用量面板）+ 设置页【DeepSeek 开放平台】入口。

- 仅对 `--profile web` 网页模式生效，随服务自动加载，**重启不丢失**（本地静态插件，非内存动态插件）。
- 全部 UI 跟随 DSH 系统主题自动切换浅色 / 深色模式。

---

## ✨ 功能

### 1. 右侧侧边栏【概览】标签（首位，固定顺序：概览 / 文件 / 变更）

**上下文窗口卡片**
- 左上角浅绿色圆角状态标签，动态显示「上下文充足 / 上下文紧张 / 上下文过载」；
- 同行右侧展示 `已使用Token/总上下文容量`（如 `25.1K/1M`）；
- 横向进度条带 80% **压缩阈值标记线**（DSH 默认 compaction 阈值），左侧填充为已用量；
- 左下「已用 X%」，右下「距压缩 N」（距 80% 阈值剩余 Token）。

**会话指标卡片（双栏网格，1 秒实时刷新）**
- 左列：平均命中 / 运行时间 / 累计tokens；右列：会话费用 / 请求数；
- **运行时长 = 任务活跃时长**：仅当 Agent 正在运行（请求 API / 输出 Token / 执行任务）时累计，
  打开浏览、查看历史、闲置时暂停计时，每秒平滑递增。

**用量分析卡片（智能动态渲染）**
- 全程只用单个模型（仅 V4-Flash 或仅 V4-Pro）：自动隐藏「来源占比」与多余模型区块，
  只展示该模型的 总计 Token / 缓存命中率 / 累计费用 / 明细进度条（输入输出占比、缓存命中未命中占比）/ 明细数据；
- 同时使用两个模型：正常展示「来源占比」条形图 + 图例 + 双模型区块；
- 尚无模型调用：显示「暂无模型调用数据」；
- 每个模型区块的【明细】可展开 / 收起（▾/▸）。

### 2. 设置页【DeepSeek 开放平台】

- 设置面板新增栏目「DeepSeek 开放平台」；
- 点击后唤起系统默认浏览器打开官方平台 <https://platform.deepseek.com>；
- hover 文字变色提示可点击，页面极简，不展示任何数据。

### 数据口径与隔离

- 侧边【概览】仅展示**当前会话实时数据**（上下文用量来自 `tokenMeter`，模型用量来自
  `llm/stream` 实时计量，费用按 **DeepSeek 官方最新峰谷定价（2026-08-17 生效）** 自动核算）；
- 设置页为纯外部跳转，与概览数据严格隔离；
- 数据实时刷新（1 秒），全部为进程内会话统计，不写任何账户历史。

---

## 📦 两种安装方式

### 方式 A：NPM 一键安装（发布到 npmjs 后）

```bash
# 1) 发布前请先修改 package.json：
#    - "name" 改为你的 npm scope：@你的用户名/dsh-dsov-plugin
#    - "repository" / "homepage" / "bugs" 填你的仓库地址
#    （改完 name 后必须重新执行 npm run build —— 客户端 bundle 的模块 id 取自包名）

npm login
npm publish          # 自动执行 prepublishOnly（先构建）

# 2) 任意机器上安装到 DSH web profile：
dsh plugin --profile web add @你的用户名/dsh-dsov-plugin

# 3) 重启 dsh web，插件随服务自动加载：
dsh --profile web
```

### 方式 B：GitHub 源码编译 + 本地 link（参考 dsh-web-ui 部署流程）

```bash
# 1) 克隆仓库
git clone https://github.com/<你的用户名>/dsh-dsov-plugin.git
cd dsh-dsov-plugin

# 2) 安装依赖（本插件零运行时依赖，纯 Node 构建；npm/pnpm 均可）
npm install          # 或 pnpm install

# 3) 构建（生成 lib/index.js 与 lib/client.js）
npm run build

# 4) 链接到本机 DSH profile（默认 web），等价于：
#    dsh plugin --profile web add link:<本仓库绝对路径>
npm run link:web     # 或 node scripts/link-profile.mjs

# 5) 重启 dsh web 使 bundle patch 生效
dsh --profile web
```

> 手动链接（PowerShell / CMD / bash 均可）：
> ```bash
> dsh plugin --profile web add link:C:/Github_Project/dsh-dsov-plugin
> ```

### 卸载

```bash
dsh plugin --profile web remove @dsh-dsov/dsh-dsov-plugin
# 或（仓库内）：
node scripts/link-profile.mjs --unlink
```

### 故障排查：`dsh plugin add` 报 pnpm lockfile 供应链策略错误

```text
ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION
Lockfile failed supply-chain policy check ...
```

`dsh plugin` 底层转发 pnpm，而 profile 的 `pnpm-workspace.yaml` 配置了
`minimumReleaseAge` 供应链策略（`minimumReleaseAgeExclude` 白名单外的新包会被拒）。
当 profile 现有 lockfile 中存在发布不足策略时限的条目时，**任何** pnpm 写操作都会被冻结，
与是否安装本插件无关。处理方式（任选）：

1. 等待违规条目超过策略时限后重试；
2. 把对应包加入 `minimumReleaseAgeExclude`（或调低 `minimumReleaseAge`）；
3. 或在 profile 目录执行 `pnpm clean --lockfile && pnpm install` 重建 lockfile。

> 本机安装时若遇到该策略，可改用等价的手工 link（无需 pnpm）：
> 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 中加入
> `"@dsh-dsov/dsh-dsov-plugin": "link:D:/Github_Project/dsh-dsov-plugin"`，
> 并在 `dsh.profile.bundles` 数组末尾加入 `"@dsh-dsov/dsh-dsov-plugin"`，
> 然后为 `node_modules/@dsh-dsov/dsh-dsov-plugin` 创建指向仓库目录的 junction。
> （profile 使用 `nodeLinker: hoisted`，junction 可被 require.resolve 正常解析。）

---

## 🛠 开发

```bash
npm run build        # 构建 lib/（零依赖 Node 脚本，无需 tsc/tsdown）
npm run link         # 构建 + 链接到 profile web
npm run link:web     # 同上
```

工程结构：

```
dsh-dsov-plugin/
├── package.json          # 可发布 npm 包（dsh.bundle.patch / dsh.client 声明）
├── cordis.patch.yml      # profile bundle patch：插入插件行 ui-dsh-dsov
├── src/
│   ├── index.js          # Host 端（llm/stream 计量 + agent 活跃计时 + /dsov 路由）
│   └── client.js         # Client 端 body（概览面板 + 设置页，浏览器运行）
├── scripts/
│   ├── build.mjs         # 构建：src → lib（含 module-loader 包装）
│   └── link-profile.mjs  # 构建 + dsh plugin add link: 部署
├── lib/                  # 构建产物（npm files 白名单包含）
├── README.md
└── LICENSE
```

### 架构说明

| 端 | 入口 | 职责 |
| --- | --- | --- |
| Host | `lib/index.js`（`exports "."`，ESM，导出 `{ inject, apply }`） | `llm/stream`（`global: true`）实时计量；`agent/status` 活跃计时；`webServer` 路由 `POST /dsov/overview`（JSON 信封 + 回环护栏） |
| Client | `lib/client.js`（`exports "./client"`，`window.__ModuleLoader__.load` 包） | 注入 aionui-panel tab 栏首位【概览】；1 秒轮询 `/dsov/overview`；注册 `settings.section`【DeepSeek 开放平台】 |

- 客户端 bundle 的模块 id 取自 `package.json` 的 `name`（与 client-modules 图节点一致），
  `React` 由构建包装层以 `require("react")` 注入（react 为 shell seed 模块）。
- 仅当 `dsh.client.platform === "web"`，web profile 才会加载该客户端包。

### Windows 说明

- 全部脚本兼容 Windows：`link-profile.mjs` 会把仓库路径转为正斜杠后传给 pnpm `link:` 协议，
  并以 `shell: true` 调用 `dsh`（npm 全局 bin 的 .cmd 垫片）。
- 若 `dsh` 不在 PATH：`npm i -g @deepseek-ai/dsh` 后重试，或在 README 手动命令中改用 dsh 的完整路径。

---

## 🔒 权限与数据

- 插件为标准模式、工作区可写权限下运行（会话权限，插件本身不请求额外权限）；
- 会话用量为进程内实时统计（重启后从零累计属正常现象）；上下文用量来自官方 `tokenMeter`；
- 官方定价常量（峰谷定价）集中在 `src/index.js` 顶部，官方调价后可按需更新。

## 📄 License

MIT

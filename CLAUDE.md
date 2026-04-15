# CLAUDE.md

## 项目概览
- 这是一个基于 **Electron + Vue 3 + Vite(electron-vite) + Fastify** 的跨平台桌面影音应用。
- 代码分为三层：
  - **main 进程**：Electron 生命周期、窗口、托盘、快捷键、IPC、本地 HTTP API、数据库、插件与系统能力。
  - **renderer 进程**：Vue 单页应用，负责页面、状态管理、播放器 UI、设置界面。
  - **packages/shared**：main/renderer 共用的配置、类型、国际化、请求封装、工具模块。
- 本仓库是 pnpm workspace，但当前 workspace 主要共享包在 `packages/*`，应用主代码仍在仓库根目录的 `src/` 下。

## 环境与启动
- Node 要求：`>=24.11.1`
- 包管理器：`pnpm`
- 首次安装：
  - `pnpm install`
- 本地开发：
  - `pnpm dev`
- 带 watch 的开发模式：
  - `pnpm dev:watch`
- 预览打包产物：
  - `pnpm start`
- 调试 Electron：
  - `pnpm debug`

## 构建、检查与测试
- 完整构建（含类型检查）：
  - `pnpm build`
- 只做质量检查：
  - `pnpm build:check`
- 平台打包：
  - `pnpm build:mac`
  - `pnpm build:win`
  - `pnpm build:linux`
- 目录打包（不生成安装包）：
  - `pnpm build:unpack`

### 代码质量
- ESLint：
  - `pnpm lint`
  - `pnpm lint:fix`
- Stylelint：
  - `pnpm stylelint`
  - `pnpm stylelint:fix`
- 类型检查：
  - `pnpm typecheck`
  - `pnpm typecheck:node`
  - `pnpm typecheck:web`
- 格式化：
  - `pnpm format`

### 测试
- 全量测试：
  - `pnpm test`
- 按项目运行：
  - `pnpm test:main`
  - `pnpm test:renderer`
  - `pnpm test:shared`
  - `pnpm test:scripts`
- 监听模式：
  - `pnpm test:watch`
- UI 模式：
  - `pnpm test:ui`
- 覆盖率：
  - `pnpm test:coverage`
- 更新 renderer 快照：
  - `pnpm test:update`
- 运行单个测试文件：
  - `pnpm vitest run src/main/services/__tests__/ProxyManager.test.ts`
  - `pnpm vitest run --project renderer src/renderer/path/to/file.spec.ts`
- 按测试名过滤：
  - `pnpm vitest run --project main -t "test name"`

## 关键架构

### 1. Electron 主进程是系统编排层
主入口在 `src/main/index.ts`。
- 这里负责：
  - Electron 启动参数与 Chromium feature 开关
  - 初始化主窗口
  - 注册 IPC
  - 托盘、菜单、协议唤起、认证回调
  - 进程级异常与 crash reporter
- 读这个文件可以快速理解“应用启动后会按什么顺序把 main 侧能力串起来”。

### 2. renderer 不直接依赖 Node，main 能力主要通过 IPC 和本地 HTTP API 暴露
有两条主要通道：
- **IPC**：`src/main/ipc.ts` + `packages/shared/config/ipcChannel.ts`
  - 负责窗口控制、系统能力、文件读写、通知、代理、重启、外部播放器调用等 Electron 原生能力。
- **Fastify 本地 API**：`src/main/services/FastifyService`
  - renderer 里的 `src/renderer/src/api/*.ts` 主要通过 HTTP 请求访问 main 侧业务接口。
  - API 基础地址来自 `packages/shared/config/env.ts` 中的 `VITE_API_URL / VITE_API_URL_PREFIX / VITE_API_PORT`。

新增能力时，先判断应该放哪条通道：
- 涉及窗口、系统、文件、Electron 原生事件：优先 IPC。
- 涉及业务查询、数据操作、插件/站源/播放解析等：优先 Fastify 路由。

### 3. Fastify 是核心业务后端，按版本和业务域组织
核心入口：
- `src/main/services/FastifyService/index.ts`
- `src/main/services/FastifyService/routes/index.ts`

路由采用自动收集：
- `routes/index.ts` 通过 `import.meta.glob('./v*/*/index.ts', { eager: true })` 自动注册路由模块。
- `v0` 路由不加版本前缀；其他版本自动挂到 `api/v{n}`。

主要业务域在 `src/main/services/FastifyService/routes/v1/`：
- `film`：影视站源、CMS 适配器、推荐、筛选等
- `live`：直播源、频道、EPG
- `parse`：解析源相关
- `moment`：历史、收藏等
- `data`：数据导入导出/云同步相关接口
- `file`：文件管理
- `setting`：设置
- `plugin`：插件
- `system`：ffmpeg、cdp、进程、m3u8 去广告等系统工具接口
- `aigc`：聊天与记忆

如果改 API：
- 路由实现与 schema 通常要一起看，schema 在同级 `schemas/v1/**`。
- 这个项目大量接口返回统一结构，renderer 的请求层默认把 `code === 0` 视为成功。

### 4. 数据层以本地 SQLite/libsql + Drizzle 为中心，并带迁移与同步
核心文件：`src/main/services/DbService/index.ts`
- 数据库文件位于应用数据目录下的 `data.db`。
- `DbService` 是单例，负责：
  - 建连
  - 执行迁移
  - 对外暴露 CRUD 聚合能力
  - 监听数据库文件变化后同步到配置存储/云端备份
- 结构分层：
  - `schemas/`：表结构
  - `crud/`：每张表的读写封装
  - `migrations/`：版本迁移

重要特征：
- 应用设置并不只是 electron-store；数据库与 `ConfigManager` 会互相同步。
- `DbService` watcher 会在 DB 变更后触发本地 store 同步，以及可选的云同步（WebDAV / iCloud）。
- 涉及设置类功能时，通常需要同时检查：
  - 数据表 schema / CRUD
  - `DbService.dbSyncStore()`
  - `ConfigManager`
  - renderer 中的 setting store / 页面

### 5. renderer 是典型的 Vue SPA，但播放页是独立业务核心
renderer 入口：`src/renderer/src/main.ts`
- 使用 Vue Router、Pinia、i18n。
- 路由定义在 `src/renderer/src/router/`，当前固定页面主要在 `router/modules/homepage.ts`。

页面大图景：
- `/film`、`/live`、`/parse`、`/moment`、`/lab`、`/setting` 是主界面业务入口。
- `/player` 是隐藏路由，但它是核心播放窗口页面。
- `/browser` 是内置浏览器窗口页面。

状态管理：
- `src/renderer/src/store/index.ts`
- Pinia 开启了：
  - `pinia-plugin-persistedstate` 持久化
  - `pinia-shared-state`，用于多窗口/多渲染上下文共享状态

这意味着改 store 时，要考虑：
- 状态是否需要持久化
- 是否会在主窗口、播放器窗口、浏览器窗口之间共享

### 6. 播放器是仓库中最有“子系统”味道的 renderer 模块
播放器相关：
- 页面：`src/renderer/src/pages/player/index.vue`
- 核心组件：`src/renderer/src/components/multi-player`
- 说明文档：`src/renderer/src/components/multi-player/README.md`

它不是单一播放器，而是一个统一抽象层，封装了多种播放器内核：
- artplayer
- dplayer
- nplayer
- oplayer
- xgplayer

这个子系统要点：
- 不同内核对 dash/flv/mpegts/torrent、请求头、弹幕、画质、多语言、右键菜单的支持不一致。
- `multi-player/README.md` 已写出很多“实际差异”，改播放逻辑前应先读。
- 播放页会结合 `store/modules/player.ts` 的状态与 IPC 事件控制窗口、暂停、隐藏、外部播放器调用等。
- 系统级流处理能力（如 m3u8 去广告）通过 main 侧 API 提供，再由播放页按需包装 URL。

### 7. shared 包不是“工具杂项”，而是跨进程契约层
`packages/shared` 里最关键的是：
- `config/*`：跨端共用常量、环境配置、窗口名、IPC channel、设置定义等
- `types/*`：跨端共享类型
- `locales/*`：共享文案
- `modules/request/*`：renderer 请求封装底座

高频原则：
- 新增跨端常量、通道名、类型，不要散落在 main/renderer 各自目录里，优先放 shared。
- `ipcChannel.ts` 和 `window.ts` 这类文件属于“约定源”，改动会影响 main 与 renderer 双端。

## 测试与项目划分约定
Vitest 已拆成 4 个 project：
- `main`: `src/main/**/*.{test,spec}.{ts,tsx}`
- `renderer`: `src/renderer/**/*.{test,spec}.{ts,tsx}`，环境为 `jsdom`
- `shared`: `packages/shared/**/*.{test,spec}.{ts,tsx}`
- `scripts`: `scripts/**/*.{test,spec}.{ts,tsx}`

修改代码时，优先跑受影响 project，而不是每次全量跑。

## 构建与打包注意点
- `electron.vite.config.ts` 同时配置 main / preload / renderer 三段构建。
- main 构建里额外声明了 worker 入口，尤其是：
  - `film_cms_adapter_t3_drpy_worker`
  - `film_cms_adapter_t3_catopen_worker`
- renderer 构建对 vendor 做了较细的分包，尤其区分了多种播放器相关依赖。
- `electron-builder.yml` 对打包排除了大量源码、测试、配置文件；如果新增运行时必需资源，要确认没有被排除。
- `asarUnpack` 当前保留了 `out/proxy/**` 与 `resources/**`，涉及运行时落地文件时要注意是否需要解包。

## 代码风格与约束
### ESLint / Vue 约束
从 `eslint.config.js` 可见的重要规则：
- 使用 `simple-import-sort`，不要手动按其他方式排序 import。
- `no-console` 关闭，可使用 console，但现有 main/renderer 更常用各自 logger。
- TS / Vue 的未使用变量允许以下划线前缀忽略。
- `.vue` 文件约束：
  - 组件标签名 kebab-case
  - 自定义事件 kebab-case
  - block 顺序固定为 `template` → `script` → `style`
  - `script` 语言必须是 `ts` 或 `tsx`
  - 样式要求 `scoped`
  - blocks 之间不留空行

### TypeScript / 路径别名
高频别名：
- main：`@main`、`@shared`、`@logger`、`@db`、`@server`
- renderer：`@`、`@renderer`、`@shared`、`@logger`

改路径别名相关问题时，优先看 `electron.vite.config.ts`，不要只看 tsconfig。

## 阅读代码的建议入口
要快速上手，建议按下面顺序读：
1. `package.json`：脚本与技术栈
2. `src/main/index.ts`：主进程启动流程
3. `src/main/ipc.ts`：Electron 能力边界
4. `src/main/services/FastifyService/index.ts` + `routes/index.ts`：本地 API 入口
5. `src/main/services/DbService/index.ts`：数据持久化与同步
6. `src/renderer/src/router/modules/homepage.ts`：前端页面地图
7. `src/renderer/src/pages/player/index.vue` + `components/multi-player/README.md`：播放核心
8. `packages/shared/config/*`：跨端契约

## 现有说明文件情况
- 仓库当前没有 `.github/copilot-instructions.md`。
- 也未发现 `.cursor/rules/` 或 `.cursorrules`。
- `README.md` 中与开发代理最相关、值得继承的信息主要是：
  - 项目定位是跨平台桌面影音应用
  - 各平台应用数据目录/二进制目录位置
  - 数据导入结构说明（尤其是 analyze / iptv / channel / site 等业务数据字段）

## 平台相关补充
README 中记录的运行时数据路径：
- macOS：`~/Library/Application Support/zyfun/`
- Linux：`~/.config/zyfun/`
- Windows：`%USERPROFILE%\\AppData\\Roaming\\zyfun\\`

这对排查数据库、日志、插件、导入导出问题很重要。

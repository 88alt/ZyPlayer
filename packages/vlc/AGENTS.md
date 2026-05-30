# AGENTS.md

## 项目概述

这是一个基于 **libVLC** 的 Node.js 原生插件项目，专为 Electron 应用提供视频播放能力。项目采用 **TypeScript + Rust (NAPI)** 混合架构。

## 技术栈

- **前端**: TypeScript (ESM/CJS)
- **原生层**: Rust (通过 `napi-rs` 框架)
- **构建工具**: `tsdown` (打包), `napi build` (原生编译)

## 项目结构

```
packages/vlc/
├── src/                         # TypeScript 源码
│   ├── index.ts                 # 主入口，默认导出
│   ├── types.ts                 # TypeScript 类型定义
│   ├── constants/               # 常量定义
│   │   ├── ipc.ts               # IPC 通讯通道定义
│   │   └── index.ts             # 默认入口
│   ├── control/                 # 主进程控制层 (API/IPC/加载器)
│   │   ├── api.ts               # VLC API 封装
│   │   ├── ipc.ts               # IPC 处理
│   │   ├── native-loader.ts     # 原生模块加载器
│   │   ├── utils.ts             # 工具函数
│   │   └── index.ts             # 默认入口
│   └── renderer/                # 渲染进程组件
│       ├── icons/               # SVG 图标资源
│       ├── lang/                # 国际化
│       │   └── locales.ts       # 语言配置
│       ├── player/              # 播放器 mixin 组件
│       │   ├── playMix.ts       # 播放控制
│       │   ├── pauseMix.ts      # 暂停控制
│       │   ├── seekMix.ts       # 进度跳转
│       │   ├── volumeMix.ts     # 音量控制
│       │   ├── fullscreenMix.ts # 全屏控制
│       │   ├── pipMix.ts        # 画中画
│       │   └── ...              # 其他 mixin
│       ├── plugins/             # 插件
│       │   ├── canvas-renderer.ts # Canvas 渲染器
│       │   └── runtime.ts       # 运行时
│       ├── style/               # 样式 (Less)
│       │   └── index.less
│       ├── utils/               # 工具函数
│       │   ├── dom.ts           # DOM 操作
│       │   ├── emitter.ts       # 事件发射器
│       │   ├── format.ts        # 格式化
│       │   └── property.ts      # 属性工具
│       ├── adapter.ts           # 适配器
│       ├── bridge.ts            # 桥接通信
│       ├── index.ts             # 默认入口
│       ├── raw.d.ts             # 原生模块类型声明
│       ├── storage.ts           # 存储
│       ├── template.ts          # 播放器模板
│       └── vlc-player.ts        # VLC 播放器组件
├── native/                      # Rust 原生代码
│   ├── src/
│   │   ├── platform/            # 平台特定实现
│   │   │   ├── macos.rs         # macOS (NSView)
│   │   │   └── mod.rs
│   │   ├── api.rs               # libVLC FFI 封装
│   │   ├── event.rs             # 事件处理
│   │   ├── ffi.rs               # FFI 类型定义
│   │   ├── lib.rs               # NAPI 绑定实现
│   │   ├── state.rs             # 状态管理
│   │   ├── types.rs             # 类型定义
│   │   └── util.rs              # 辅助工具
│   ├── build.rs                 # 构建脚本
│   └── Cargo.toml
├── example/                     # Electron 示例应用
│   ├── electron.cjs             # 主进程逻辑
│   ├── preload.cjs              # 接口暴露逻辑
│   ├── renderer.js              # 渲染进程逻辑
│   └── index.html
├── lib/                         # 编译输出 (ESM/CJS)
└── build/                       # 原生二进制文件
```

## 核心架构

### 双层设计

1. **TypeScript 层** (`src/`): 提供 Promise 化的异步 API，处理跨线程调用
2. **Rust 原生层** (`native/`): 通过 NAPI 调用 libVLC C API，管理播放器状态和事件

### 状态管理

- 使用 `once_cell::sync::Lazy` 实现线程安全的全局状态
- `PlayerContext` 包含 `instance` 和 `player` 句柄
- 事件回调通过 `ThreadsafeFunction` 在 Rust 和 JS 间传递

### 平台特定实现

- **macOS**: 使用 `NSView` 进行视频渲染 (`platform/macos.rs`)
- **Windows**: 待实现 (`HWND`)
- **Linux**: 待实现 (`XWindow`)

## 开发命令

```bash
# 完整构建流程 (clean -> native -> ts -> css)
npm run build

# 分步构建
npm run build:native  # napi build (Release 模式)
npm run build:ts      # tsdown 打包 TypeScript
npm run build:css     # less 编译样式

# 类型检查
npm run typecheck     # tsc --noEmit

# 运行示例应用
npm run dev           # 启动 Electron 示例应用
```

## 主要 API

完整 API 文档见 [docs/api.md](docs/api.md)，包含类型定义、Control API（主进程）、Renderer API（渲染进程）的详细说明。

快速概览：

| 层级     | 入口                                            | 核心                                            |
| -------- | ----------------------------------------------- | ----------------------------------------------- |
| 主进程   | `import { VlcApi, ipc } from '@zy/vlc/control'` | `VlcApi` 类（30+ 方法）+ `ipc()` 注册处理器     |
| 渲染进程 | `import { VlcPlayer } from '@zy/vlc/renderer'`  | `new VlcPlayer()` → `IVlcRuntime` + Canvas 渲染 |

## 关键实现细节

### 1. 线程安全

- Rust 代码使用 `lock_state()` 确保状态访问的线程安全
- 事件回调通过 `ThreadsafeFunction` 在后台线程触发，避免阻塞主线程

### 2. 内存管理

- `play_media` 在创建新播放器前会安全释放旧播放器
- 使用 `CString` 处理字符串以避免内存泄漏

### 3. 事件系统

- 支持所有 libVLC 事件类型 (播放、暂停、停止、结束、错误等)
- 事件数据通过 `VlcEventPayload` 结构传递

### 4. 路径处理

- HTTP 流媒体使用 `libvlc_media_new_location`
- 本地文件使用 `libvlc_media_new_path` 并进行路径规范化

## 注意事项

1. **VLC 库依赖**: 需要系统中安装 VLC 应用程序（包含 `libvlc` 动态库）
2. **动态库路径**: macOS 默认 `/Applications/VLC.app/Contents/MacOS/lib/libvlc.dylib`
3. **平台限制**: 当前仅实现 macOS，Windows/Linux 需补充 `platform/` 实现
4. **窗口句柄**: macOS 需传递 `NSView` 指针（通过 `BigInt` 类型）
5. **双入口导出**: 包导出 `./control`（主进程）和 `./renderer`（渲染进程）两个入口

## 构建输出

编译后生成：

- `lib/control.mjs` / `lib/control.cjs` - 主进程控制层
- `lib/renderer.mjs` / `lib/renderer.cjs` - 渲染进程组件
- `lib/*.d.mts` - TypeScript 类型定义
- `build/vlc_native.node` - 原生二进制文件

## 示例用法

**主进程** (`main.ts`):

```typescript
import { app } from 'electron';
import { ipc } from '@zy/vlc/control';

app.whenReady().then(() => {
  ipc(); // 注册所有 IPC 处理器
});
```

**渲染进程** (`renderer.ts`):

```typescript
import { VlcPlayer } from '@zy/vlc/renderer';
import '@zy/vlc/renderer.css';

const runtime = new VlcPlayer(
  {
    libPath: '/Applications/VLC.app/Contents/MacOS/lib/libvlc.dylib',
    pluginPath: '/Applications/VLC.app/Contents/MacOS/plugins',
  },
  {
    el: '#player',
    url: 'https://example.com/video.mp4',
    autoplay: true,
    volume: 0.8,
  },
);

// 销毁
// runtime.destroy();
```

更多示例见 [example/](example/) 目录。

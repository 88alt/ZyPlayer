# @zy/vlc API 文档

基于 libVLC 的 Electron 原生视频播放器插件。采用 TypeScript + Rust (NAPI) 混合架构，通过 Electron IPC 实现主进程与渲染进程通信，Canvas 渲染视频帧。

## 安装前提

- 需要系统已安装 VLC 应用（加载 `libvlc.dylib` / 共享库）
- VLC 下载: https://get.videolan.org/vlc/last/

## 包导出

| 导入路径               | 说明                                 |
| ---------------------- | ------------------------------------ |
| `@zy/vlc/control`      | 主进程 API（`VlcApi` 类 + IPC 注册） |
| `@zy/vlc/renderer`     | 渲染进程 API（`VlcPlayer` 入口）     |
| `@zy/vlc/renderer.css` | 渲染器样式                           |

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│  Renderer Process                                    │
│  new VlcPlayer() → IVlcRuntime                    │
│       ↓ IPC Bridge (ipcRenderer.invoke)              │
├─────────────────────────────────────────────────────┤
│  Main Process                                        │
│  ipc() → VlcApi → Rust NAPI addon (libVLC FFI)      │
└─────────────────────────────────────────────────────┘
```

- **主进程** (`@zy/vlc/control`): `VlcApi` 封装 Rust 原生模块，`ipc()` 注册所有 `ipcMain.handle` 处理器
- **渲染进程** (`@zy/vlc/renderer`): `new VlcPlayer()` 创建完整播放器 UI，通过 IPC Bridge 与主进程通信
- **视频渲染**: VLC 在 Rust 内部渲染帧 → `getFrameRgba()` 返回 RGBA `Uint8Array` → Canvas 渲染器绘制到 HTML Canvas

---

## 类型定义

所有共享类型从 `@zy/vlc/types` 导出。

### IVlcPlayerState

播放器状态枚举：

```typescript
type IVlcPlayerState =
  | 'nothing-special'
  | 'opening'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error'
  | 'unknown';
```

### IVlcTrack

轨道信息：

```typescript
interface IVlcTrack {
  id: number;
  name: string;
  isActive: boolean;
}
```

### IVlcEventPayload

事件回调载荷：

```typescript
interface IVlcEventPayload {
  instanceId?: string;
  eventType: string;
  value: number;
  additionalInfo: string;
}
```

### IVlcInitPath

libVLC 路径配置：

```typescript
interface IVlcInitPath {
  libPath: string; // libVLC 动态库路径（必填）
  pluginPath?: string; // VLC 插件目录路径（可选）
}
```

### IVlcInitOptions

播放器初始化选项：

```typescript
interface IVlcInitOptions {
  el: string; // 挂载容器 CSS 选择器
  url: string; // 播放地址（本地路径或在线 URL）
  headers?: Record<string, string>; // 在线资源请求头
  debug?: boolean; // 是否输出 Rust 层 [vlc-native] 日志，默认 false
  seekStep?: number; // 快进/快退步进（毫秒），默认 5000
  volumeStep?: number; // 音量步进，默认 0.05
  autoplay?: boolean; // 是否自动播放，默认 true
  volume?: number; // 初始音量（0~1），默认 0.7
  muted?: boolean; // 是否静音，默认 false
  loop?: boolean; // 是否循环播放
  startTime?: number; // 初始起播时间（毫秒）
  playbackRate?: number; // 初始播放倍率，默认 1
  playbackRates?: number[]; // 可选倍速列表，默认 [0.5, 0.75, 1, 1.25, 1.5, 2]
  locale?: IVlcLocale; // 语言 ('zh-CN' | 'zh-TW' | 'en-US')
  i18n?: IVlcI18n; // 自定义国际化文案覆盖
  playNext?: () => void; // 播放下一个回调
  playPrev?: () => void; // 播放上一个回调
}
```

### IVlcI18n

国际化文案键值对（所有键均为可选）：

```typescript
type IVlcI18nKey =
  | 'playerTitle'
  | 'placeholderLoading'
  | 'placeholderStopped'
  | 'placeholderError'
  | 'placeholderInitError'
  | 'statusIdle'
  | 'statusReady'
  | 'statusOpening'
  | 'statusPlaying'
  | 'statusPaused'
  | 'statusStopped'
  | 'statusEnded'
  | 'statusError'
  | 'statusPipUnsupported'
  | 'statusPipError'
  | 'statusBuffering'
  | 'labelVolume'
  | 'labelPlaybackRate'
  | 'actionPlay'
  | 'actionPause'
  | 'actionMute'
  | 'actionUnmute'
  | 'actionPictureInPicture'
  | 'actionExitPictureInPicture'
  | 'actionFullscreen'
  | 'actionExitFullscreen'
  | 'actionNext'
  | 'actionPrev'
  | 'actionForward'
  | 'actionBackward';

type IVlcI18n = Partial<Record<IVlcI18nKey, string>>;
```

---

## Control API（主进程）

```typescript
import { VlcApi, ipc } from '@zy/vlc/control';
```

### ipc()

在主进程中注册所有 IPC 处理器。必须在 Electron `app.whenReady()` 之后调用。

```typescript
function ipc(): void;
```

调用后，渲染进程可通过 `ipcRenderer.invoke('vlc:*', ...)` 访问所有播放器方法。内部维护 `Map<string, VlcApi>` 实例映射，通过 `instanceId` 区分多播放器。

---

### VlcApi 类

```typescript
class VlcApi implements IVlcApiContract {
  constructor(instanceId?: string); // 默认 'default'
}
```

每个实例绑定一个 `instanceId`，对应一个 libVLC 播放器实例。

#### 方法列表

| 方法               | 参数                                                               | 返回值            | 说明                                |
| ------------------ | ------------------------------------------------------------------ | ----------------- | ----------------------------------- |
| `create`           | `path: IVlcInitPath, options: IVlcInitOptions`                     | `string`          | 初始化 libVLC，返回实例 ID          |
| `play`             | 无                                                                 | `void`            | 开始播放                            |
| `pause`            | 无                                                                 | `void`            | 暂停播放                            |
| `toggle`           | 无                                                                 | `void`            | 切换播放/暂停                       |
| `stop`             | 无                                                                 | `void`            | 停止播放并释放资源                  |
| `attach`           | `handle: bigint`                                                   | `void`            | 设置原生窗口句柄（macOS NSView 等） |
| `setFrameFormat`   | `width: number, height: number`                                    | `void`            | 设置帧渲染尺寸                      |
| `getFrameRgba`     | 无                                                                 | `Uint8Array`      | 获取当前帧 RGBA 数据                |
| `getState`         | 无                                                                 | `IVlcPlayerState` | 获取播放器状态                      |
| `getPlaying`       | 无                                                                 | `boolean`         | 是否正在播放                        |
| `getEnded`         | 无                                                                 | `boolean`         | 是否播放结束                        |
| `setVolume`        | `volume: number`                                                   | `void`            | 设置音量（0~1）                     |
| `getVolume`        | 无                                                                 | `number`          | 获取音量                            |
| `setMuted`         | `muted: boolean`                                                   | `void`            | 设置静音                            |
| `getMuted`         | 无                                                                 | `boolean`         | 获取静音状态                        |
| `seek`             | `time: number`                                                     | `void`            | 跳转到指定时间（毫秒）              |
| `setProgress`      | `progress: number`                                                 | `void`            | 设置播放进度（0~1）                 |
| `getProgress`      | 无                                                                 | `number`          | 获取播放进度（0~1）                 |
| `getDuration`      | 无                                                                 | `number`          | 获取总时长（毫秒）                  |
| `getPlayed`        | 无                                                                 | `number`          | 获取已播放时长（毫秒）              |
| `getBuffered`      | 无                                                                 | `number`          | 获取缓冲进度                        |
| `setPlaybackRate`  | `rate: number`                                                     | `void`            | 设置播放速率                        |
| `getPlaybackRate`  | 无                                                                 | `number`          | 获取播放速率                        |
| `getSubtitleTrack` | 无                                                                 | `IVlcTrack[]`     | 获取字幕轨道列表                    |
| `setSubtitleTrack` | `id: number`                                                       | `void`            | 激活指定字幕轨道                    |
| `addSubtitleFile`  | `subtitlePath: string`                                             | `void`            | 添加外部字幕文件                    |
| `getAudioTrack`    | 无                                                                 | `IVlcTrack[]`     | 获取音频轨道列表                    |
| `setAudioTrack`    | `id: number`                                                       | `void`            | 激活指定音频轨道                    |
| `onEvent`          | `eventName: string, callback: (payload: IVlcEventPayload) => void` | `void`            | 注册事件回调                        |
| `destroy`          | 无                                                                 | `void`            | 销毁播放器释放资源                  |

#### 使用示例

```typescript
import { app } from 'electron';
import { ipc, VlcApi } from '@zy/vlc/control';

app.whenReady().then(() => {
  // 注册 IPC 处理器
  ipc();

  // 直接使用 API（非 IPC 模式）
  const player = new VlcApi('my-player');
  player.create(
    {
      libPath: '/Applications/VLC.app/Contents/MacOS/lib/libvlc.dylib',
      pluginPath: '/Applications/VLC.app/Contents/MacOS/plugins',
    },
    {
      el: '',
      url: 'https://example.com/video.mp4',
      autoplay: false,
      volume: 0.8,
      playbackRate: 1,
    },
  );

  player.onEvent('Playing', (payload) => {
    console.log('事件:', payload.eventType, payload.value);
  });

  player.play();
});
```

---

## Renderer API（渲染进程）

```typescript
import { VlcPlayer } from '@zy/vlc/renderer';
import '@zy/vlc/renderer.css';
```

### VlcPlayer

渲染进程入口类，创建完整播放器实例。

```typescript
class VlcPlayer implements IVlcRuntime {
  constructor(path: IVlcInitPath, options: IVlcInitOptions);
  adapter: VlcAdapter;
  destroy(): void;
}
```

**参数：**

- `path`: libVLC 路径配置
- `options`: 播放器选项（`el` 为挂载容器的 CSS 选择器）

**实例结构：** `IVlcRuntime`

```typescript
interface IVlcRuntime extends IVlcPlayer {
  adapter: VlcAdapter;
  destroy: () => void;
}
```

#### 使用示例

```typescript
import { VlcPlayer } from '@zy/vlc/renderer';
import '@zy/vlc/renderer.css';

const runtime = new VlcPlayer(
  {
    libPath: '/Applications/VLC.app/Contents/MacOS/lib/libvlc.dylib',
    pluginPath: '/Applications/VLC.app/Contents/MacOS/plugins',
  },
  {
    el: '#player-container',
    url: 'https://example.com/video.mp4',
    autoplay: true,
    volume: 0.8,
    locale: 'zh-CN',
  },
);

// 销毁
runtime.destroy();
```

---

### IVlcRuntime 对象

由 `new VlcPlayer()` 直接创建的播放器对象，基于 mixin 模式组合了播放控制、UI 模板和事件系统，并额外提供 `destroy()`。

#### 状态属性

| 属性             | 类型                         | 说明               |
| ---------------- | ---------------------------- | ------------------ |
| `state`          | `string`                     | 当前播放器状态     |
| `isReady`        | `boolean`                    | 是否就绪           |
| `playing`        | `boolean`                    | 是否正在播放       |
| `currentTime`    | `number`                     | 当前播放时间（秒） |
| `duration`       | `number`                     | 总时长（秒）       |
| `volume`         | `number`                     | 音量（0~1）        |
| `muted`          | `boolean`                    | 是否静音           |
| `playbackRate`   | `number`                     | 播放速率           |
| `fullscreenWeb`  | `boolean`                    | 是否网页全屏       |
| `pip`            | `boolean`                    | 是否画中画         |
| `pipEnabled`     | `boolean`                    | 画中画是否可用     |
| `adapter`        | `VlcAdapter`                 | 底层适配器实例     |
| `canvasRenderer` | `IVlcCanvasRenderer \| null` | Canvas 渲染器      |

#### 播放控制

| 方法     | 参数 | 返回值          | 说明          |
| -------- | ---- | --------------- | ------------- |
| `play`   | 无   | `Promise<void>` | 播放          |
| `pause`  | 无   | `void`          | 暂停          |
| `toggle` | 无   | `void`          | 切换播放/暂停 |

#### 可写属性（setter）

| 属性       | 类型     | 说明                      |
| ---------- | -------- | ------------------------- |
| `seek`     | `number` | 跳转到指定时间（秒）      |
| `forward`  | `number` | 快进（秒）                |
| `backward` | `number` | 快退（秒）                |
| `played`   | `number` | 跳转到指定播放进度（0~1） |

#### 事件系统

```typescript
player.on(name: string, fn: (...args: any[]) => void): void;
player.off(name: string, fn?: (...args: any[]) => void): void;
player.once(name: string, fn: (...args: any[]) => void): void;
player.emit(name: string, ...args: any[]): void;
player.proxy(el: HTMLElement | Window, event: string, fn: (e: any) => void): () => void;
```

#### 内部服务

| 属性       | 类型                                         | 说明         |
| ---------- | -------------------------------------------- | ------------ |
| `template` | `Template`                                   | DOM 模板     |
| `notice`   | `{ show: string \| Error; silent: boolean }` | 通知         |
| `i18n`     | `{ get: (key: string) => string }`           | 国际化       |
| `storage`  | `Storage`                                    | 本地存储     |
| `cssVar`   | `(key: string, value?: string) => any`       | CSS 变量操作 |

---

### VlcAdapter 类

底层播放器适配器，封装 IPC Bridge 通信和播放状态管理。

```typescript
import type { VlcAdapter } from '@zy/vlc/renderer';
```

#### 属性

| 属性           | 类型                                        | 读写 | 说明                           |
| -------------- | ------------------------------------------- | ---- | ------------------------------ |
| `instance`     | `IVlcBridge \| null`                        | 只读 | IPC Bridge 实例                |
| `playing`      | `boolean`                                   | 只读 | 是否正在播放                   |
| `muted`        | `boolean`                                   | 读写 | 静音状态（持久化到 Storage）   |
| `volume`       | `number`                                    | 读写 | 音量 0~1（自动 clamp，持久化） |
| `playbackRate` | `number`                                    | 读写 | 播放速率（持久化）             |
| `currentTime`  | `number`                                    | 只读 | 当前时间（毫秒）               |
| `duration`     | `number`                                    | 只读 | 总时长（毫秒）                 |
| `progress`     | `number`                                    | 只读 | 播放进度（0~1）                |
| `time`         | `{ currentTime: number; duration: number }` | 只读 | 时间快照                       |

#### 生命周期

| 方法      | 参数                                              | 返回值          | 说明                                                     |
| --------- | ------------------------------------------------- | --------------- | -------------------------------------------------------- |
| `create`  | `path: IVlcInitPath, options: IVlcAdapterOptions` | `void`          | 创建 IPC Bridge 并初始化配置                             |
| `init`    | 无                                                | `Promise<void>` | 初始化播放器、设置帧格式（1280x720）、启动轮询、开始播放 |
| `destroy` | 无                                                | `void`          | 停止轮询、清除监听器、销毁 Bridge                        |

#### 播放控制

| 方法          | 参数               | 返回值 | 说明                                        |
| ------------- | ------------------ | ------ | ------------------------------------------- |
| `play`        | 无                 | `void` | 播放                                        |
| `pause`       | 无                 | `void` | 暂停                                        |
| `togglePlay`  | 无                 | `void` | 切换播放/暂停                               |
| `toggleMuted` | 无                 | `void` | 切换静音                                    |
| `seek`        | `time: number`     | `void` | 跳转到指定时间（毫秒），内部转换为 progress |
| `setProgress` | `progress: number` | `void` | 设置进度（0~1）                             |

#### 帧访问

| 方法             | 参数                            | 返回值       | 说明                 |
| ---------------- | ------------------------------- | ------------ | -------------------- |
| `getFrameRgba`   | 无                              | `Uint8Array` | 获取当前帧 RGBA 数据 |
| `setFrameFormat` | `width: number, height: number` | `void`       | 设置帧渲染尺寸       |

#### 时间更新轮询

```typescript
adapter.onTimeUpdate(callback: (args: { currentTime: number; duration: number }) => void): void;
adapter.offTimeUpdate(): void;
```

内部以 500ms 间隔轮询 `getPlayed()` 和 `getDuration()`。

#### 度量查询

| 方法                | 返回值    | 说明               |
| ------------------- | --------- | ------------------ |
| `getPlayed()`       | `number`  | 已播放时长（毫秒） |
| `getDuration()`     | `number`  | 总时长（毫秒）     |
| `getProgress()`     | `number`  | 播放进度（0~1）    |
| `getVolume()`       | `number`  | 音量               |
| `getMuted()`        | `boolean` | 静音状态           |
| `getPlaybackRate()` | `number`  | 播放速率           |

#### 事件

```typescript
adapter.on(event: string, handler: (...args: any[]) => void): void;
adapter.off(event: string, handler?: (...args: any[]) => void): void;
adapter.onEvent(callback: (payload: IVlcEventPayload) => void): () => void; // 返回取消订阅函数
```

---

### IVlcBridge 接口

IPC 通信桥接层，由 `createBridge()` 创建。渲染进程通过 `ipcRenderer.invoke` 调用主进程 VLC 操作。

```typescript
interface IVlcBridge {
  create: (mountSelector: string) => void | Promise<void>;
  play: () => void;
  pause: () => void;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  setMuted: (muted: boolean) => void;
  getMuted: () => boolean;
  setProgress: (progress: number) => void;
  getProgress: () => number;
  getDuration: () => number;
  getPlayed: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  setFrameFormat: (width: number, height: number) => void;
  getFrameRgba: () => Uint8Array;
  onEvent: (callback: (payload: IVlcEventPayload) => void) => () => void;
  destroy: () => void;
}

function createBridge(path: IVlcInitPath, options: IVlcInitOptions, instanceId?: string): IVlcBridge;
```

Bridge 内部通过 250ms 轮询缓存 metrics（volume, progress, duration, played, playbackRate, muted），getter 直接返回缓存值，setter 异步调用 IPC 后立即更新缓存。

---

### Template 类

播放器 DOM 模板，负责创建和管理播放器 UI 元素。

```typescript
class Template {
  constructor(vlc: any, t?: I18nFn);
  static html(t: I18nFn): string;
  query<T extends HTMLElement>(selector: string): T | null;
  queryMust<T extends HTMLElement>(selector: string): T;
  init(): void;
  destroy(removeHtml?: boolean): void;
}
```

#### DOM 元素引用

| 属性             | 类型                | 说明            |
| ---------------- | ------------------- | --------------- |
| `$container`     | `HTMLElement`       | 最外层容器      |
| `$player`        | `HTMLElement`       | 播放器容器      |
| `$videoStage`    | `HTMLElement`       | 视频舞台        |
| `$videoCanvas`   | `HTMLCanvasElement` | 视频渲染 Canvas |
| `$placeholder`   | `HTMLElement`       | 占位符          |
| `$topbar`        | `HTMLElement`       | 顶部栏          |
| `$notice`        | `HTMLElement`       | 通知栏          |
| `$controlsStage` | `HTMLElement`       | 控制栏          |
| `$progress`      | `HTMLInputElement`  | 进度条          |
| `$timeLeft`      | `HTMLElement`       | 左侧时间        |
| `$timeRight`     | `HTMLElement`       | 右侧时间        |
| `$btnPlay`       | `HTMLElement`       | 播放按钮        |
| `$btnMute`       | `HTMLElement`       | 静音按钮        |
| `$volume`        | `HTMLInputElement`  | 音量滑块        |
| `$rateBtn`       | `HTMLElement`       | 倍率按钮        |
| `$rateOptions`   | `HTMLElement`       | 倍率选项        |
| `$btnPip`        | `HTMLElement`       | 画中画按钮      |
| `$btnFullscreen` | `HTMLElement`       | 全屏按钮        |
| `$btnNext`       | `HTMLElement`       | 下一个按钮      |
| `$btnPrev`       | `HTMLElement`       | 上一个按钮      |

---

### IVlcCanvasRenderer 接口

Canvas 帧渲染器，将 VLC RGBA 帧数据绘制到 HTML Canvas。

```typescript
interface IVlcCanvasRenderer {
  renderSourceToDisplay: () => void;
  renderToCanvas: (targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D) => void;
  resizeCanvasToStage: () => void;
  clearDisplayCanvas: () => void;
  scheduleCanvasResize: () => void;
  startFramePump: () => void;
  stopFramePump: () => void;
  setPipActive: (active: boolean) => void;
  initFrameData: () => void;
  onFrame: (callback: () => void) => void;
  destroy: () => void;
}

function createCanvasRenderer(
  refs: { videoCanvas: HTMLCanvasElement; videoStage: HTMLElement },
  adapter: VlcAdapter,
): IVlcCanvasRenderer;
```

---

### Storage 类

基于 localStorage 的播放器配置持久化。

```typescript
class Storage {
  constructor();
  get(): Record<string, any>; // 获取全部
  get(key: string): any; // 获取指定键
  set(key: string, value: any): void;
  del(key: string): void;
  clear(): void;
}
```

持久化键：`volume`, `muted`, `playrate`。

---

### 图标工具

```typescript
function resolveDemoIcon(name: IVlcIconKey): string;
function populateSvgIcons(root: ParentNode): void;
function setIVlcIconResolver(resolver: IVlcIconResolver | null | undefined): void;
function resetIVlcIconResolver(): void;
```

`IVlcIconKey`: `'play'` | `'pause'` | `'volume'` | `'volumeSmall'` | `'muted'` | `'pip'` | `'pipExit'` | `'fullscreen'` | `'fullscreenExit'` | `'mnext'` | `'mprev'`

---

## 注意事项

- **多实例支持**: 通过 `instanceId` 区分多个播放器实例，IPC 自动路由到对应实例
- **帧渲染**: 默认 1280x720，通过 `requestAnimationFrame` 驱动帧泵，Bridge 内部防并发请求
- **状态轮询**: Bridge 以 250ms 间隔轮询 metrics，Adapter 以 500ms 间隔触发 `onTimeUpdate` 回调
- **平台限制**: `attach` 方法传入原生窗口句柄（macOS 为 NSView 指针的 `bigint`），仅用于原生窗口渲染场景
- **本地字幕**: `addSubtitleFile` 本地文件需要 `file:///` 前缀
- **Storage 持久化**: 音量、静音、播放速率自动持久化到 localStorage，下次初始化时恢复

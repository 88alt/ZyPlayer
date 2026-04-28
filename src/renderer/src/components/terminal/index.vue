<template>
  <div
    class="xterm-container"
    :style="{
      backgroundColor: themes[props.options.theme || 'XtermDark'].background,
    }"
  >
    <div ref="terminalDivRef" class="xterm-content"></div>
  </div>
</template>
<script lang="ts" setup>
defineOptions({
  name: 'XTerm',
});

const props = defineProps({
  options: {
    type: Object as PropType<IXTermOptions>,
    default: () => ({}),
  },
  ws: {
    type: String,
    default: '',
  },
  console: {
    type: Boolean,
    default: false,
  },
  onKeyCallback: {
    type: Function as PropType<(key: string) => void>,
    default: (_key: string) => {},
  },
  onLinkClickCallback: {
    type: Function as PropType<(uri: string) => void>,
    default: (_uri: string) => {},
  },
  onConnectionStatusChanged: {
    type: Function as PropType<(status: ConnectionStatus) => void>,
    default: (_status: ConnectionStatus) => {},
  },
});

import '@xterm/xterm/css/xterm.css';

import type { LogLevel } from '@shared/config/logger';
import { ANSICOLORS, LEVEL, LEVEL_COLOR_MAP } from '@shared/config/logger';
import { toString } from '@shared/modules/toString';
import { isJsonStr } from '@shared/modules/validate';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import type { ITerminalOptions } from '@xterm/xterm';
import { Terminal as XTerm } from '@xterm/xterm';
import { merge } from 'es-toolkit';
import JSON5 from 'json5';
import type { PropType } from 'vue';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { SearchBarAddon } from 'xterm-addon-search-bar';

import { isMacOS } from '@/utils/systeminfo';

import themes from './utils/theme';

export type { ITerminalOptions } from '@xterm/xterm';
import { MessagePlugin } from 'tdesign-vue-next';

import { t } from '@/locales';

export type IXTerm = XTerm;
export type IXTermLog = LogLevel;
export type IXTermTheme = 'XtermDark' | 'XtermLight';
export type IXTermSearchTheme = 'XtermSearchDark' | 'XtermSearchLight';
export type IXTermOptions = Omit<ITerminalOptions, 'theme'> & {
  theme?: IXTermTheme;
  searchTheme?: IXTermSearchTheme;
};
type ITerminalConsoleLog = Exclude<LogLevel, 'verbose' | 'silly' | 'none'> | 'log';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// terminal
const terminalDivRef = useTemplateRef<HTMLElement>('terminalDivRef');
const xtermInstance = ref<IXTerm | null>(null);
const fitAddonRef = ref<FitAddon | null>(null);
const searchbarAddonRef = ref<SearchBarAddon | null>(null);
const terminalTextSelect = ref<boolean>(false);

// ws
const websocketInstance = ref<WebSocket | null>(null);
const connecting = ref(false);
const connected = ref(false);
const pingLooper = ref<number | null>(null);

// listen
let resizeObserver: ResizeObserver | null = null;

watch(
  () => props.options,
  async (val) => {
    if (xtermInstance.value) {
      Object.assign(xtermInstance.value.options, {
        ...val,
        theme: { ...themes[val.theme || 'XtermDark'] },
      });
      xtermInstance.value.focus();
      searchbarAddonRef.value?.applyTheme(themes[val.searchTheme || 'XtermSearchDark']);
    } else {
      await nextTick();
      connectTerminal();
    }
  },
  { deep: true },
);

watch(
  () => props.ws,
  async () => {
    await nextTick();
    connectTerminal();
  },
  { deep: true },
);

onMounted(() => setup());
onUnmounted(() => dispose());

const isWebglSupported = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const buildWebSocketUrl = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;

  if (rawUrl.startsWith('ws://') || rawUrl.startsWith('wss://')) return rawUrl;

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    const normalized = new URL(rawUrl);
    normalized.protocol = normalized.protocol === 'https:' ? 'wss:' : 'ws:';
    return normalized.toString();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
};

const emitConnectionStatus = () => {
  props.onConnectionStatusChanged?.(connecting.value ? 'connecting' : connected.value ? 'connected' : 'disconnected');
};

const connectWebSocket = () => {
  connecting.value = true;
  connected.value = false;
  emitConnectionStatus();

  websocketInstance.value = new WebSocket(buildWebSocketUrl(props.ws));

  websocketInstance.value.onopen = () => {
    pingLooper.value = window.setInterval(() => {
      if (websocketInstance.value && websocketInstance.value.readyState === WebSocket.OPEN) {
        websocketInstance.value.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5000);
  };

  websocketInstance.value.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'data') {
      xtermInstance.value?.write(data.data);
    } else if (data.type === 'connected') {
      MessagePlugin.success(t('component.terminal.terminal.success'));

      connecting.value = false;
      connected.value = true;
      emitConnectionStatus();

      xtermInstance.value?.focus();
      requestAnimationFrame(() => handleResize());
    } else if (data.type === 'resize') {
      const { col, row } = JSON.parse(data.data);
      xtermInstance.value?.resize(col, row);
    } else if (data.type === 'error') {
      MessagePlugin.error(`t('common.error'): ${data.data}`);
    }
  };

  websocketInstance.value.onclose = (event) => {
    if (websocketInstance.value === event.target) {
      connecting.value = false;
      connected.value = false;
      emitConnectionStatus();
    }
  };

  websocketInstance.value.onerror = (event) => {
    if (websocketInstance.value === event.target) {
      connecting.value = false;
      connected.value = false;
      emitConnectionStatus();

      MessagePlugin.error(t('component.terminal.terminal.error'));
    }
  };
};

const connectTerminal = () => {
  resetTerminal();

  xtermInstance.value = new XTerm(
    merge(
      {
        allowProposedApi: true,
        fontFamily: '"JetBrains Mono Variable", monospace',
        fontSize: 12,
      },
      { ...props.options, ...{ theme: themes[props.options.theme || 'XtermDark'] } },
    ),
  );

  xtermInstance.value.open(terminalDivRef.value!);

  const fitAddon = new FitAddon();
  fitAddonRef.value = fitAddon;

  const unicode11Addon = new Unicode11Addon();
  const webLinksAddon = new WebLinksAddon();
  const search = new SearchAddon();
  const searchBar = new SearchBarAddon({
    searchAddon: search,
    theme: themes[props.options.searchTheme || 'XtermSearchDark'],
  });
  searchbarAddonRef.value = searchBar;
  xtermInstance.value.loadAddon(fitAddon);
  if (isWebglSupported()) {
    const webglAddon = new WebglAddon();
    xtermInstance.value.loadAddon(webglAddon);
  }

  xtermInstance.value.loadAddon(search);
  xtermInstance.value.loadAddon(searchBar);
  xtermInstance.value.loadAddon(unicode11Addon);
  xtermInstance.value.loadAddon(webLinksAddon);

  fitAddonRef.value.fit();

  xtermInstance.value.onKey((e: { key: string; domEvent: KeyboardEvent }) => {
    const ev = e.domEvent;
    const key = ev.key === 'Enter' ? '\n' : e.key;

    props.onKeyCallback?.(key);
  });

  xtermInstance.value.onSelectionChange(() => {
    terminalTextSelect.value = xtermInstance.value?.hasSelection() ?? false;
  });

  xtermInstance.value.onData((data) => {
    if (websocketInstance.value && websocketInstance.value.readyState === WebSocket.OPEN) {
      websocketInstance.value.send(
        JSON.stringify({
          type: 'data',
          data,
        }),
      );
    }
  });

  terminalDivRef.value?.addEventListener('keydown', handleKeyDown, true);

  if (props.ws) connectWebSocket();
};

const handleResize = () => {
  if (!xtermInstance.value) return;

  fitAddonRef.value?.fit();

  if (websocketInstance.value && websocketInstance.value.readyState === WebSocket.OPEN) {
    websocketInstance.value.send(
      JSON.stringify({
        type: 'resize',
        data: JSON.stringify({
          row: xtermInstance.value.rows,
          col: xtermInstance.value.cols,
        }),
      }),
    );
  }
};

const resetTerminal = () => {
  if (xtermInstance.value) {
    xtermInstance.value?.dispose();
    xtermInstance.value = null;
  }

  if (websocketInstance.value) {
    websocketInstance.value.close();
    websocketInstance.value = null;
  }

  if (pingLooper.value) {
    clearInterval(pingLooper.value);
    pingLooper.value = null;
  }

  connecting.value = false;
  connected.value = false;
  emitConnectionStatus();
};

const clear = () => {
  xtermInstance.value?.clear();
  xtermInstance.value?.reset();
};

const focus = () => {
  xtermInstance.value?.focus();
  fitAddonRef.value?.fit();
};

const colorText = (text: string, color: string) => {
  return ANSICOLORS[color] + text + ANSICOLORS.END;
};

const write = (val: unknown, level: IXTermLog = LEVEL.VERBOSE, ln: boolean = true, prefix?: string) => {
  let content = toString(val);
  if (isJsonStr(content)) content = JSON.stringify(JSON5.parse(content), null, 2);

  let text = content;
  let custom = prefix;
  if (prefix) {
    const main = colorText(colorText(prefix, LEVEL_COLOR_MAP[level]), 'BOLD');
    const symbol = colorText('>', 'BOLD');
    custom = `${main} ${symbol} `;
  } else {
    const main = colorText(colorText(content, LEVEL_COLOR_MAP[level]), 'BOLD');
    text = main;
  }

  text = colorText(text, 'BOLD');

  if (xtermInstance.value) {
    if (prefix) xtermInstance.value.write(custom!);
    ln ? xtermInstance.value.writeln(text) : xtermInstance.value.write(text);

    if (!terminalTextSelect.value) xtermInstance.value.scrollToBottom();
  }

  if (props.console) {
    const allowedLevels: ITerminalConsoleLog[] = [LEVEL.ERROR, LEVEL.WARN, LEVEL.INFO, LEVEL.DEBUG];
    const consoleLevel: ITerminalConsoleLog = allowedLevels.includes(level as ITerminalConsoleLog)
      ? (level as ITerminalConsoleLog)
      : 'log';

    const logArgs = prefix ? [prefix, val] : [val];
    console[consoleLevel](...logArgs);
  }
};

// 阻止误刷新/关闭页面导致终端会话中断
const handleBeforeUnload = (event: BeforeUnloadEvent): string | void => {
  if (connected.value) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
};

const setup = async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);

  await nextTick();
  if (terminalDivRef.value) {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(terminalDivRef.value);
  }

  connectTerminal();
};

const dispose = () => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  resizeObserver?.disconnect();
  resetTerminal();
};

const handleKeyDown = (ev: KeyboardEvent) => {
  const key = ev.key.toLowerCase();

  if ((isMacOS && ev.metaKey && key === 'f') || (!isMacOS && ev.ctrlKey && key === 'f')) {
    ev.preventDefault();
    searchbarAddonRef.value?.show();
  }

  if ((isMacOS && ev.metaKey && key === 'l') || (!isMacOS && ev.ctrlKey && key === 'l')) {
    ev.preventDefault();
    clear();
  }
};

defineExpose({
  clear,
  dispose,
  focus,
  write,
});
</script>
<style lang="less" scoped>
.xterm-container {
  width: 100%;
  height: 100%;
  padding: var(--td-pop-padding-l);

  .xterm-content {
    width: 100%;
    height: 100%;
  }
}
</style>

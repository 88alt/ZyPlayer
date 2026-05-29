import type { IVlcCanvasRenderer } from '../../types';
import type { VlcAdapter, VlcFrameSize } from '../adapter';

const FRAME_CHANNELS = 4;
const MIN_CANVAS_SIZE = 2;
const DISPLAY_ASPECT = 16 / 9;
const WEBGL_CONTEXT_OPTIONS: WebGLContextAttributes = {
  alpha: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
};

interface RendererRefs {
  videoCanvas: HTMLCanvasElement;
  videoStage: HTMLElement;
  pipCanvas?: HTMLCanvasElement | null;
}

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasDisplaySize {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

interface FrameBackend {
  initFrameData: () => void;
  uploadFrame: (frame: Uint8Array) => void;
  renderSourceToDisplay: () => void;
  renderSourceToCanvas: (targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D) => void;
  clearDisplayCanvas: () => void;
  onDisplayResize: () => void;
  destroy: () => void;
}

interface PipBackend {
  uploadFrame: (frame: Uint8Array) => void;
  clear: () => void;
}

const VERT_SRC = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_pos + 1.0) * 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_tex;
  void main() {
    gl_FragColor = texture2D(u_tex, v_uv);
  }
`;

export function createCanvasRenderer(refs: RendererRefs, adapter: VlcAdapter): IVlcCanvasRenderer {
  const getFrameSize = (): VlcFrameSize => adapter.getFrameSize();
  const backend = createPreferredBackend(refs, getFrameSize);
  const pipBackend = refs.pipCanvas ? createPipBackend(refs.pipCanvas, getFrameSize) : null;
  return createRendererController(refs, adapter, backend, pipBackend, getFrameSize);
}

function createPreferredBackend(refs: RendererRefs, getFrameSize: () => VlcFrameSize): FrameBackend {
  if (canUseWebGL()) {
    const gl = getWebGLContext(refs.videoCanvas);
    if (gl) {
      try {
        return createWebGLBackend(refs, gl, getFrameSize);
      } catch (e) {
        throw new Error(`WebGL renderer initialization failed: ${String(e)}`);
      }
    }
  }

  const canvasCtx = refs.videoCanvas.getContext('2d');
  if (!canvasCtx) throw new Error('canvas context is unavailable');
  return createCanvas2DBackend(refs, canvasCtx, getFrameSize);
}

function canUseWebGL(): boolean {
  const testCanvas = document.createElement('canvas');
  const gl = getWebGLContext(testCanvas);
  if (!gl) return false;

  try {
    const program = createWebGLProgram(gl);
    gl.deleteProgram(program);
    return true;
  } catch (e) {
    console.warn('[canvas-renderer] WebGL probe failed, falling back to Canvas2D:', e);
    return false;
  }
}

function createRendererController(
  refs: RendererRefs,
  adapter: VlcAdapter,
  backend: FrameBackend,
  pipBackend: PipBackend | null,
  getFrameSize: () => VlcFrameSize,
): IVlcCanvasRenderer {
  let framePumpActive = false;
  let resizeRafId = 0;
  let onFrameCallback: (() => void) | null = null;
  let pipActive = false;
  let lastFrame: Uint8Array | null = null;

  function getTargetCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
    const rect = canvas.getBoundingClientRect();
    return getDevicePixelSize(rect.width, rect.height);
  }

  function resizeCanvasToStage(force = false): void {
    const rect = refs.videoStage.getBoundingClientRect();
    const size = getDisplaySize(rect.width, rect.height);
    syncCanvasDisplaySize(refs.videoCanvas, size);
    const resized = setCanvasSize(refs.videoCanvas, size.pixelWidth, size.pixelHeight);
    if (!resized && !force) return;

    backend.onDisplayResize();
    backend.renderSourceToDisplay();
  }

  function scheduleCanvasResize(): void {
    if (resizeRafId) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0;
      resizeCanvasToStage();
    });
  }

  function renderToCanvas(targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    const size = getTargetCanvasSize(targetCanvas);
    setCanvasSize(targetCanvas, size.width, size.height);
    backend.renderSourceToCanvas(targetCanvas, targetCtx);
  }

  function pumpVideoFrame(): void {
    if (!framePumpActive) return;

    try {
      const frame = adapter.getFrameRgba();
      if (frame.length === getExpectedFrameLength(getFrameSize())) {
        lastFrame = frame;
        if (pipActive && pipBackend) {
          pipBackend.uploadFrame(frame);
        } else {
          backend.uploadFrame(frame);
          backend.renderSourceToDisplay();
        }
        if (onFrameCallback) onFrameCallback();
      }
    } catch {
      // ignore frame read failures
    }

    requestAnimationFrame(pumpVideoFrame);
  }

  function startFramePump(): void {
    if (framePumpActive) return;
    framePumpActive = true;
    requestAnimationFrame(pumpVideoFrame);
  }

  function stopFramePump(): void {
    framePumpActive = false;
  }

  function destroy(): void {
    stopFramePump();
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
    backend.destroy();
  }

  return {
    renderSourceToDisplay: backend.renderSourceToDisplay,
    renderToCanvas,
    resizeCanvasToStage,
    clearDisplayCanvas: backend.clearDisplayCanvas,
    scheduleCanvasResize,
    startFramePump,
    stopFramePump,
    setPipActive(active: boolean): void {
      pipActive = active;
      if (active) {
        pipBackend?.clear();
        backend.clearDisplayCanvas();
      } else {
        if (lastFrame) backend.uploadFrame(lastFrame);
        resizeCanvasToStage(true);
      }
    },
    initFrameData: backend.initFrameData,
    onFrame(callback: () => void): void {
      onFrameCallback = callback;
    },
    destroy,
  };
}

function getDevicePixelSize(width: number, height: number): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  return {
    width: Math.max(MIN_CANVAS_SIZE, Math.round(width * dpr)),
    height: Math.max(MIN_CANVAS_SIZE, Math.round(height * dpr)),
  };
}

function getDisplaySize(stageWidth: number, stageHeight: number): CanvasDisplaySize {
  const safeStageWidth = Math.max(MIN_CANVAS_SIZE, stageWidth);
  const safeStageHeight = Math.max(MIN_CANVAS_SIZE, stageHeight);
  const stageAspect = safeStageWidth / safeStageHeight;

  let cssWidth: number;
  let cssHeight: number;

  if (stageAspect > DISPLAY_ASPECT) {
    cssHeight = safeStageHeight;
    cssWidth = cssHeight * DISPLAY_ASPECT;
  } else {
    cssWidth = safeStageWidth;
    cssHeight = cssWidth / DISPLAY_ASPECT;
  }

  const pixelSize = getDevicePixelSize(cssWidth, cssHeight);
  return {
    cssWidth,
    cssHeight,
    pixelWidth: pixelSize.width,
    pixelHeight: pixelSize.height,
  };
}

function syncCanvasDisplaySize(canvas: HTMLCanvasElement, size: CanvasDisplaySize): void {
  canvas.style.width = `${size.cssWidth}px`;
  canvas.style.height = `${size.cssHeight}px`;
}

function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

function getExpectedFrameLength(frameSize: VlcFrameSize): number {
  return frameSize.width * frameSize.height * FRAME_CHANNELS;
}

function getFitRect(srcWidth: number, srcHeight: number, destWidth: number, destHeight: number): DrawRect | null {
  if (srcWidth <= 0 || srcHeight <= 0 || destWidth <= 0 || destHeight <= 0) return null;

  const scale = Math.min(destWidth / srcWidth, destHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return {
    x: (destWidth - width) / 2,
    y: (destHeight - height) / 2,
    width,
    height,
  };
}

function clearCanvas2D(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
}

function drawAspectFit(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const rect = getFitRect(sourceCanvas.width, sourceCanvas.height, width, height);
  if (!rect) return;

  targetCtx.imageSmoothingEnabled = true;
  clearCanvas2D(targetCtx, width, height);
  targetCtx.drawImage(
    sourceCanvas,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
}

function getWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  return (canvas.getContext('webgl', WEBGL_CONTEXT_OPTIONS) ??
    canvas.getContext('experimental-webgl', WEBGL_CONTEXT_OPTIONS)) as WebGLRenderingContext | null;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader creation failed');

  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createWebGLProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error('program creation failed');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function createWebGLBackend(
  refs: RendererRefs,
  gl: WebGLRenderingContext,
  getFrameSize: () => VlcFrameSize,
): FrameBackend {
  const canvas = refs.videoCanvas;
  const program = createWebGLProgram(gl);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  const uTex = gl.getUniformLocation(program, 'u_tex');
  const quadBuffer = gl.createBuffer();
  const texture = gl.createTexture();

  if (aPos < 0 || !uTex || !quadBuffer || !texture) {
    gl.deleteProgram(program);
    if (quadBuffer) gl.deleteBuffer(quadBuffer);
    if (texture) gl.deleteTexture(texture);
    throw new Error('WebGL renderer initialization failed');
  }

  let contextLost = false;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastFrameWidth = 0;
  let lastFrameHeight = 0;

  function bindResources(): void {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uTex, 0);
    gl.clearColor(0, 0, 0, 1);
  }

  function syncViewport(): void {
    if (contextLost) return;
    const { width, height } = canvas;
    const frameSize = getFrameSize();
    if (width <= 0 || height <= 0) return;
    if (
      width === lastWidth &&
      height === lastHeight &&
      frameSize.width === lastFrameWidth &&
      frameSize.height === lastFrameHeight
    ) {
      return;
    }

    lastWidth = width;
    lastHeight = height;
    lastFrameWidth = frameSize.width;
    lastFrameHeight = frameSize.height;
    gl.viewport(0, 0, width, height);

    const rect = getFitRect(frameSize.width, frameSize.height, width, height);
    if (!rect) return;

    const left = (rect.x / width) * 2 - 1;
    const right = ((rect.x + rect.width) / width) * 2 - 1;
    const bottom = (rect.y / height) * -2 + 1;
    const top = ((rect.y + rect.height) / height) * -2 + 1;

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([left, bottom, right, bottom, left, top, right, top]),
      gl.DYNAMIC_DRAW,
    );
  }

  function onContextLost(event: Event): void {
    event.preventDefault();
    contextLost = true;
  }

  function onContextRestored(): void {
    contextLost = false;
    lastWidth = 0;
    lastHeight = 0;
    bindResources();
    syncViewport();
  }

  bindResources();

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  return {
    initFrameData(): void {
      syncViewport();
    },
    uploadFrame(frame: Uint8Array): void {
      if (contextLost) return;
      const frameSize = getFrameSize();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frameSize.width, frameSize.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    },
    renderSourceToDisplay(): void {
      if (contextLost) return;
      syncViewport();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    renderSourceToCanvas(targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
      targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      targetCtx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
    },
    clearDisplayCanvas(): void {
      if (contextLost) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    onDisplayResize(): void {
      lastWidth = 0;
      lastHeight = 0;
      lastFrameWidth = 0;
      lastFrameHeight = 0;
      syncViewport();
    },
    destroy(): void {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      gl.deleteTexture(texture);
      gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
    },
  };
}

function createCanvas2DBackend(
  refs: RendererRefs,
  canvasCtx: CanvasRenderingContext2D,
  getFrameSize: () => VlcFrameSize,
): FrameBackend {
  const sourceCanvas = document.createElement('canvas');
  const initialFrameSize = getFrameSize();
  sourceCanvas.width = initialFrameSize.width;
  sourceCanvas.height = initialFrameSize.height;

  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error('source canvas context is unavailable');

  let frameImageData: ImageData | null = null;

  function syncSourceSize(): VlcFrameSize {
    const frameSize = getFrameSize();
    if (sourceCanvas.width !== frameSize.width || sourceCanvas.height !== frameSize.height) {
      sourceCanvas.width = frameSize.width;
      sourceCanvas.height = frameSize.height;
      frameImageData = null;
    }
    return frameSize;
  }

  return {
    initFrameData(): void {
      const frameSize = syncSourceSize();
      frameImageData = sourceCtx.createImageData(frameSize.width, frameSize.height);
    },
    uploadFrame(frame: Uint8Array): void {
      const frameSize = syncSourceSize();
      if (!frameImageData) {
        frameImageData = sourceCtx.createImageData(frameSize.width, frameSize.height);
      }
      frameImageData.data.set(frame);
      sourceCtx.putImageData(frameImageData, 0, 0);
    },
    renderSourceToDisplay(): void {
      drawAspectFit(sourceCanvas, canvasCtx, refs.videoCanvas.width, refs.videoCanvas.height);
    },
    renderSourceToCanvas(targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
      drawAspectFit(sourceCanvas, targetCtx, targetCanvas.width, targetCanvas.height);
    },
    clearDisplayCanvas(): void {
      clearCanvas2D(canvasCtx, refs.videoCanvas.width, refs.videoCanvas.height);
    },
    onDisplayResize(): void {
      canvasCtx.imageSmoothingEnabled = true;
    },
    destroy(): void {},
  };
}

function createPipBackend(pipCanvas: HTMLCanvasElement, getFrameSize: () => VlcFrameSize): PipBackend {
  const initialFrameSize = getFrameSize();
  pipCanvas.width = initialFrameSize.width;
  pipCanvas.height = initialFrameSize.height;

  const pipCtx = pipCanvas.getContext('2d');
  if (!pipCtx) throw new Error('PiP canvas context is unavailable');
  const ctx = pipCtx;

  let frameImageData = ctx.createImageData(initialFrameSize.width, initialFrameSize.height);

  function syncCanvasSize(): VlcFrameSize {
    const frameSize = getFrameSize();
    if (pipCanvas.width !== frameSize.width || pipCanvas.height !== frameSize.height) {
      pipCanvas.width = frameSize.width;
      pipCanvas.height = frameSize.height;
      frameImageData = ctx.createImageData(frameSize.width, frameSize.height);
    }
    return frameSize;
  }

  return {
    uploadFrame(frame: Uint8Array): void {
      syncCanvasSize();
      frameImageData.data.set(frame);
      ctx.putImageData(frameImageData, 0, 0);
    },
    clear(): void {
      clearCanvas2D(ctx, pipCanvas.width, pipCanvas.height);
    },
  };
}

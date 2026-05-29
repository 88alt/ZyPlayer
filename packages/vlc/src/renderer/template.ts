import { populateSvgIcons } from './icons';
import { query } from './utils/dom';

type I18nFn = (key: string, vars?: Record<string, string | number>) => string;

interface HTMLVideoElementLike {
  play: () => Promise<void>;
  pause: () => void;
  volume: number;
  muted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  readyState: number;
  playing?: boolean;
}

export class Template {
  private vlc: any;
  private t: I18nFn;

  $container!: HTMLElement;
  $player!: HTMLElement;
  $video!: HTMLVideoElementLike;
  $videoStage!: HTMLElement;
  $videoCanvas!: HTMLCanvasElement;
  $placeholder!: HTMLElement;
  $loading!: HTMLElement;
  $loadingText!: HTMLElement;
  $notice!: HTMLElement;
  $controlsStage!: HTMLElement;
  $timeLeft!: HTMLElement;
  $progressTouch!: HTMLElement;
  $prog!: HTMLElement;
  $progBuf!: HTMLElement;
  $progSub!: HTMLElement;
  $timeRight!: HTMLElement;
  $btnPlay!: HTMLElement;
  $playIcon!: HTMLElement;
  $btnMute!: HTMLElement;
  $muteIcon!: HTMLElement;
  $volumeProg!: HTMLElement;
  $volumeSub!: HTMLElement;
  $rateBtn!: HTMLElement;
  $rateIcon!: HTMLElement;
  $rateOptions!: HTMLElement;
  $btnPip!: HTMLElement;
  $pipIcon!: HTMLElement;
  $btnFullscreen!: HTMLElement;
  $fullscreenIcon!: HTMLElement;
  $btnNext!: HTMLElement;
  $btnPrev!: HTMLElement;
  $rateMenu!: HTMLElement;

  constructor(vlc: any, t?: I18nFn) {
    this.vlc = vlc;
    this.t = t ?? ((key: string) => key);
    const { option } = vlc;

    if (option.container instanceof HTMLElement) {
      this.$container = option.container;
    } else {
      this.$container = query(option.container) as HTMLElement;
    }

    this.query = this.query.bind(this);
    this.init();
  }

  static html(t: I18nFn, playbackRates?: number[]): string {
    return `
      <div id="vlc-player">
        <div id="video-stage">
          <div id="video-area">
            <canvas id="video-canvas"></canvas>
            <span class="placeholder" id="placeholder">${t('placeholderLoading')}</span>
            <div class="loading hidden" id="loading" role="status" aria-live="polite" aria-hidden="true">
              <span class="loading-spinner"></span>
              <span class="loading-text" id="loading-text">${t('placeholderLoading')}</span>
            </div>
          </div>
          <div class="notice" id="notice"></div>
        </div>

        <div id="controls-stage" class="controls-fade">
          <div class="XPlayer_playerCtrlPCW">
            <div class="defaultController_playCtrl">
              <div id="playCtrlLeft">
                <div class="progressEx_container playerButtons_volumeProg">
                  <div class="playerButtons_MuteBtn" id="btn-mute" data-entity="${t('actionMute')}" style="cursor: pointer;">
                    <div id="icon" class="icon" data-icon="volume"></div>
                  </div>
                  <div id="prog">
                    <div id="progBk"></div>
                    <div id="buf"></div>
                    <div id="sub">
                      <div id="subEnd"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="playCtrlCenter">
                <div class="playerButtons_prevBtn hidden" id="btn-prev" data-entity="${t('actionPrev')}" style="cursor: pointer;">
                  <div id="icon" class="icon" data-icon="mprev"></div>
                </div>
                <div class="playerButtons_pauseBtn primary" id="btn-play" data-entity="${t('actionPlay')}" style="cursor: pointer;">
                  <div id="icon" class="icon" data-icon="play"></div>
                </div>
                <div class="playerButtons_nextBtn hidden" id="btn-next" data-entity="${t('actionNext')}" style="cursor: pointer;">
                  <div id="icon" class="icon" data-icon="mnext"></div>
                </div>
              </div>

              <div id="playCtrlRight">
                <div class="rate-menu" id="rate-menu">
                  <div class="playerButtons_rateBtn" id="rate-btn" data-entity="1x" style="cursor: pointer;">
                    <div id="icon">1x</div>
                  </div>
                  <div class="rate-options" id="rate-options">
                    ${(playbackRates ?? [0.5, 1, 1.25, 1.5, 2]).map((r) => `<button class="rate-option" data-rate="${r}">${r}x</button>`).join('')}
                  </div>
                </div>
                <div class="playerButtons_pipBtn" id="btn-pip" data-entity="${t('actionPictureInPicture')}" style="cursor: pointer;">
                  <div id="icon" class="icon" data-icon="pip"></div>
                </div>
                <div class="playerButtons_fullScreenBtn" id="btn-fullscreen" data-entity="${t('actionFullscreen')}" style="cursor: pointer;">
                  <div id="icon" class="icon" data-icon="fullscreen"></div>
                </div>
              </div>
            </div>

            <div id="xplayerProgressTouch" class="progressBar_container progressBar_progressTouchArea">
              <div class="progressEx_container progressBar_playProg">
                <span id="timePos">0:00</span>
                <div id="prog">
                  <div id="progBk"></div>
                  <div id="buf"></div>
                  <div id="sub">
                    <div id="subEnd"></div>
                  </div>
                </div>
                <span id="timeLen">0:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return query(selector, this.$container) as T | null;
  }

  queryMust<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.query<T>(selector);
    if (!el) throw new Error(`missing element: ${selector}`);
    return el;
  }

  init(): void {
    const { option, adapter } = this.vlc;

    if (!option.useSSR) {
      this.$container.innerHTML = Template.html(this.t, option.playbackRates);
      populateSvgIcons(this.$container);
    }

    // Create $video proxy for mixins that expect HTMLVideoElement interface
    this.$video = {
      play() {
        adapter.play();
        return Promise.resolve();
      },
      pause() {
        adapter.pause();
      },
      get volume() {
        return adapter.volume;
      },
      set volume(v: number) {
        adapter.volume = v;
      },
      get muted() {
        return adapter.muted;
      },
      set muted(v: boolean) {
        adapter.muted = v;
      },
      get playbackRate() {
        return adapter.playbackRate;
      },
      set playbackRate(v: number) {
        adapter.playbackRate = v;
      },
      get currentTime() {
        return adapter.currentTime / 1000;
      },
      set currentTime(v: number) {
        void adapter.setProgress(v / (adapter.duration / 1000));
      },
      get duration() {
        return adapter.duration / 1000;
      },
      get paused() {
        return !adapter.playing;
      },
      get ended() {
        return adapter.ended;
      },
      get readyState() {
        return 4;
      },
    };

    this.$player = this.queryMust('#vlc-player');
    this.$videoStage = this.queryMust('#video-stage');
    this.$videoCanvas = this.queryMust('#video-canvas');
    this.$placeholder = this.queryMust('#placeholder');
    this.$loading = this.queryMust('#loading');
    this.$loadingText = this.queryMust('#loading-text');
    this.$notice = this.queryMust('#notice');
    this.$controlsStage = this.queryMust('#controls-stage');
    this.$timeLeft = this.queryMust('#timePos');
    this.$progressTouch = this.queryMust('#xplayerProgressTouch');
    this.$prog = this.queryMust('.progressBar_playProg #prog');
    this.$progBuf = this.queryMust('.progressBar_playProg #buf');
    this.$progSub = this.queryMust('.progressBar_playProg #sub');
    this.$timeRight = this.queryMust('#timeLen');
    this.$btnPlay = this.queryMust('#btn-play');
    this.$playIcon = this.queryMust('#btn-play #icon');
    this.$btnMute = this.queryMust('#btn-mute');
    this.$muteIcon = this.queryMust('#btn-mute #icon');
    this.$volumeProg = this.queryMust('.playerButtons_volumeProg #prog');
    this.$volumeSub = this.queryMust('.playerButtons_volumeProg #sub');
    this.$rateBtn = this.queryMust('#rate-btn');
    this.$rateIcon = this.queryMust('#rate-btn #icon');
    this.$rateOptions = this.queryMust('#rate-options');
    this.$rateMenu = this.queryMust('#rate-menu');
    this.$btnPip = this.queryMust('#btn-pip');
    this.$pipIcon = this.queryMust('#btn-pip #icon');
    this.$btnFullscreen = this.queryMust('#btn-fullscreen');
    this.$fullscreenIcon = this.queryMust('#btn-fullscreen #icon');
    this.$btnNext = this.queryMust('#btn-next');
    this.$btnPrev = this.queryMust('#btn-prev');
  }

  destroy(removeHtml?: boolean): void {
    if (removeHtml) {
      this.$container.innerHTML = '';
    }
  }
}

import type { IXGI18nText } from 'xgplayer';
import { I18N, Plugin, Sniffer, Util } from 'xgplayer';

import { icons } from '../../../utils/static';

const LANG: Array<IXGI18nText> = [
  {
    LANG: 'zh-cn',
    TEXT: {
      danmuOpacity: '不透明度',
      danmuArea: '显示区域',
      danmuSpeed: '弹幕速度',
      danmuFontSize: '字体大小',
      danmuFilter: '屏蔽类型',
      danmuScroll: '滚动',
      danmuTop: '顶部',
      danmuBottom: '底部',
      danmuColor: '色彩',
    },
  },
  {
    LANG: 'zh-hk',
    TEXT: {
      danmuOpacity: '不透明度',
      danmuArea: '顯示區域',
      danmuSpeed: '彈幕速度',
      danmuFontSize: '字體大小',
      danmuFilter: '屏蔽類型',
      danmuScroll: '滾動',
      danmuTop: '頂部',
      danmuBottom: '底部',
      danmuColor: '色彩',
    },
  },
  {
    LANG: 'en',
    TEXT: {
      danmuOpacity: 'Opacity',
      danmuArea: 'Area',
      danmuSpeed: 'Speed',
      danmuFontSize: 'Font Size',
      danmuFilter: 'Filter',
      danmuScroll: 'Scroll',
      danmuTop: 'Top',
      danmuBottom: 'Bottom',
      danmuColor: 'Color',
    },
  },
];
I18N.extend(LANG);

const { POSITIONS } = Plugin;

interface SliderMeta {
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  getText: (value: number) => string;
}

export default class DanmuSettingsPlugin extends Plugin {
  static get pluginName() {
    return 'danmuSettings';
  }

  static get defaultConfig() {
    return {
      position: POSITIONS.CONTROLS_RIGHT,
      index: 11,
    };
  }

  constructor(args: any) {
    super(args);
  }

  registerIcons() {
    return {
      panelDanmu: icons.danmu,
    };
  }

  afterCreate() {
    // @ts-expect-error ts(2339)
    this.appendChild('.xgplayer-danmu-panel .xgplayer-icon', this.icons.panelDanmu);

    const toggleEvent = Sniffer.device === 'mobile' ? 'click' : 'mouseenter';
    this.bind(toggleEvent, this.showSlider);
    this.bind('mouseleave', this.hideSlider);

    // Hide mode button bindings
    this.bind('.xgplayer-hide-scroll', 'click', this.onClickHideScroll);
    this.bind('.xgplayer-hide-top', 'click', this.onClickHideTop);
    this.bind('.xgplayer-hide-bottom', 'click', this.onClickHideBottom);
    this.bind('.xgplayer-hide-color', 'click', this.onClickHideColor);

    Util.setTimeout(
      this,
      () => {
        this.bindSliders();
        this.initDefaults();
      },
      0,
    );
  }

  // ---- Custom slider system ----

  private sliderMetaMap(): Record<string, SliderMeta> {
    return {
      'xgplayer-opacity': {
        min: 0,
        max: 100,

        step: 1,
        onChange: (v) => {
          const d = this.getDanmuPlugin();
          if (d?.setOpacity) d.setOpacity(v / 100);
        },
        getText: (v) => `${Math.round(v)}%`,
      },
      'xgplayer-area': {
        min: 0,
        max: 100,

        step: 1,
        onChange: (v) => {
          const d = this.getDanmuPlugin();
          if (d?.setArea) d.setArea({ start: 0, end: v / 100 });
        },
        getText: (v) => `${v}%`,
      },
      'xgplayer-speed': {
        min: 50,
        max: 200,

        step: 50,
        onChange: (v) => {
          const d = this.getDanmuPlugin();
          if (d?.danmujs?.setAllDuration) d.danmujs.setAllDuration('scroll', Math.round(5000 / (v / 100)));
        },
        getText: (v) => `${v / 100}x`,
      },
      'xgplayer-font': {
        min: 50,
        max: 250,

        step: 10,
        onChange: (v) => {
          const size = Math.round(24 * (v / 100));
          const d = this.getDanmuPlugin();
          if (d?.setFontSize) d.setFontSize(size, size);
        },
        getText: (v) => `${v}%`,
      },
    };
  }

  bindSliders() {
    Object.entries(this.sliderMetaMap()).forEach(([name, meta]) => {
      const slider = this.find(`.xgplayer-slider-${name}`) as HTMLElement;
      if (!slider) return;

      // Click on track to jump
      this.bind(`.xgplayer-slider-track-${name}`, 'click', (e: Event) => {
        const pct = this.eventToPercent(e as MouseEvent, slider);
        this.setSliderValue(name, this.percentToValue(pct, meta));
        meta.onChange(this.readSliderValue(name, meta));
      });

      // Drag thumb
      this.bind(`.xgplayer-slider-thumb-${name}`, 'mousedown', (e: Event) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
          const pct = this.eventToPercent(ev, slider);
          this.setSliderValue(name, this.percentToValue(pct, meta));
          meta.onChange(this.readSliderValue(name, meta));
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  private eventToPercent(e: MouseEvent, slider: HTMLElement): number {
    const rect = slider.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  private percentToValue(pct: number, meta: SliderMeta): number {
    const raw = meta.min + (pct / 100) * (meta.max - meta.min);
    return Math.round(raw / meta.step) * meta.step;
  }

  setSliderValue(name: string, value: number) {
    const meta = this.sliderMetaMap()[name];
    if (!meta) return;
    const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;

    const thumb = this.find(`.xgplayer-slider-thumb-${name}`) as HTMLElement;
    const fill = this.find(`.xgplayer-slider-fill-${name}`) as HTMLElement;
    if (thumb) thumb.style.left = `${pct}%`;
    if (fill) fill.style.width = `${pct}%`;

    this.updateSliderValue(name, meta.getText(value));
  }

  readSliderValue(name: string, meta: SliderMeta): number {
    const slider = this.find(`.xgplayer-slider-${name}`) as HTMLElement;
    const thumb = this.find(`.xgplayer-slider-thumb-${name}`) as HTMLElement;
    if (!slider || !thumb) return meta.min;
    const pct = Number.parseFloat(thumb.style.left) || 0;
    return this.percentToValue(pct, meta);
  }

  // ---- Defaults ----

  initDefaults() {
    const danmu = this.getDanmuPlugin();
    const config = danmu?.config;
    if (!config) return;

    if (config.opacity !== undefined) {
      this.setSliderValue('xgplayer-opacity', Math.round(config.opacity * 100));
    }
    if (config.fontSize !== undefined) {
      const val = Math.max(50, Math.min(250, Math.round((config.fontSize / 24) * 100)));
      this.setSliderValue('xgplayer-font', val);
    }
    if (config.area?.end !== undefined) {
      this.setSliderValue('xgplayer-area', Math.round(config.area.end * 100));
    }
  }

  getDanmuPlugin() {
    return this.player.getPlugin('danmu') || (this.player as any).plugins?.danmu;
  }

  updateSliderValue(name: string, text: string) {
    const valEl = this.find(`.xgplayer-panel-value[data-slider="xgplayer-${name}-slider"]`) as HTMLElement;
    if (valEl) valEl.textContent = text;
  }

  // ---- Panel visibility ----

  showSlider = (e?: Event) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    (this.root as HTMLElement).classList.add('slide-show');
  };

  hideSlider = (e?: Event) => {
    const root = this.root as HTMLElement;
    if (e) {
      const relTarget = (e as MouseEvent).relatedTarget as HTMLElement;
      if (relTarget && root.contains(relTarget)) return;
    }
    root.classList.remove('slide-show');
  };

  // ---- Hide mode ----

  toggleHideMode(el: HTMLElement) {
    const mode = el.getAttribute('data-mode');
    if (!mode) return;
    const isHidden = el.getAttribute('data-hidden') === 'true';
    el.setAttribute('data-hidden', isHidden ? 'false' : 'true');
    const danmu = this.getDanmuPlugin();
    if (!danmu) return;
    if (isHidden) danmu.showMode?.(mode);
    else danmu.hideMode?.(mode);
  }

  onClickHideScroll = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleHideMode(this.find('.xgplayer-hide-scroll') as HTMLElement);
  };

  onClickHideTop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleHideMode(this.find('.xgplayer-hide-top') as HTMLElement);
  };

  onClickHideBottom = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleHideMode(this.find('.xgplayer-hide-bottom') as HTMLElement);
  };

  onClickHideColor = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleHideMode(this.find('.xgplayer-hide-color') as HTMLElement);
  };

  // ---- Cleanup ----

  destroy() {
    this.unbind(['click', 'mouseenter'], this.showSlider);
    this.unbind('mouseleave', this.hideSlider);
  }

  // ---- Render ----

  render() {
    const i18n = this.i18n as any;

    const sliderHtml = (
      name: string,
      label: string,
      _val: number,
      valueText: string,
      labels?: string[],
      showDots?: boolean,
    ) => {
      const meta = this.sliderMetaMap()[name];
      if (!meta) return '';
      const steps = (meta.max - meta.min) / meta.step;
      const dots = showDots
        ? Array.from({ length: steps + 1 })
            .fill(`<div class="xgplayer-slider-dot"></div>`)
            .join('')
        : '';
      const labelsHtml = labels
        ? `<div class="xgplayer-slider-labels">${labels.map((t) => `<div class="xgplayer-slider-label">${t}</div>`).join('')}</div>`
        : '';

      return `
      <div class="xgplayer-panel-row xgplayer-panel-slider-row">
        <span class="xgplayer-panel-label">${label}</span>
        <div class="xgplayer-panel-slider-wrap">
          <div class="xgplayer-slider xgplayer-slider-${name}" style="touch-action:none" data-name="${name}">
            <div class="xgplayer-slider-track xgplayer-slider-track-${name}">
              ${dots ? `<div class="xgplayer-slider-dots">${dots}</div>` : ''}
              <div class="xgplayer-slider-fill xgplayer-slider-fill-${name}"></div>
            </div>
            <div class="xgplayer-slider-thumb xgplayer-slider-thumb-${name}"></div>
            ${labelsHtml}
          </div>
        </div>
        <span class="xgplayer-panel-value" data-slider="xgplayer-${name}-slider">${valueText}</span>
      </div>`;
    };

    const speedLabels = ['0.5x', '1x', '1.5x', '2x'];

    return `
    <xg-icon class="xgplayer-danmu-panel">
      <div class="xgplayer-icon"></div>
      <xg-slider class="xgplayer-slider">
        <div class="xgplayer-panel-row xgplayer-hide-row">
          <span class="xgplayer-panel-label">${i18n.danmuFilter}</span>
          <div class="xgplayer-hide-btns">
            <span class="xgplayer-hide-btn xgplayer-hide-scroll" data-mode="scroll" data-hidden="false">${i18n.danmuScroll}</span>
            <span class="xgplayer-hide-btn xgplayer-hide-top" data-mode="top" data-hidden="false">${i18n.danmuTop}</span>
            <span class="xgplayer-hide-btn xgplayer-hide-bottom" data-mode="bottom" data-hidden="false">${i18n.danmuBottom}</span>
            <span class="xgplayer-hide-btn xgplayer-hide-color" data-mode="color" data-hidden="false">${i18n.danmuColor}</span>
          </div>
        </div>
        ${sliderHtml('xgplayer-opacity', i18n.danmuOpacity, 100, '100%')}
        ${sliderHtml('xgplayer-area', i18n.danmuArea, 85, '85%')}
        ${sliderHtml('xgplayer-speed', i18n.danmuSpeed, 100, '1x', speedLabels, true)}
        ${sliderHtml('xgplayer-font', i18n.danmuFontSize, 100, '100%')}
      </xg-slider>
    </xg-icon>`;
  }
}

import type { IVlcIconKey, IVlcIconResolver } from '../../types';
import fullscreenSvg from './fullscreen.svg?raw';
import fullscreenExitSvg from './fullscreenExit.svg?raw';
import nextSvg from './mnext.svg?raw';
import prevSvg from './mprev.svg?raw';
import pauseSvg from './pause.svg?raw';
import pipSvg from './pip.svg?raw';
import pipExitSvg from './pipExit.svg?raw';
import playSvg from './play.svg?raw';
import volumeLargeSvg from './volumeLarge.svg?raw';
import mutedSvg from './volumeMuted.svg?raw';
import volumeSmallSvg from './volumeSmall.svg?raw';

function extractInnerSvg(raw: string): string {
  const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const inner = match ? match[1].trim() : raw;
  return normalizeIconColor(inner);
}

function normalizeIconColor(inner: string): string {
  return inner.replace(/\sfill=(["'])#(?:fff|ffffff)\1/gi, ' fill=$1currentColor$1');
}

function wrapSvg(inner: string): string {
  return `<svg viewBox="0 0 16 15" aria-hidden="true" focusable="false">${inner}</svg>`;
}

const VLC_ICONS: Record<IVlcIconKey, string> = {
  play: extractInnerSvg(playSvg),
  pause: extractInnerSvg(pauseSvg),
  volume: extractInnerSvg(volumeLargeSvg),
  volumeSmall: extractInnerSvg(volumeSmallSvg),
  muted: extractInnerSvg(mutedSvg),
  pip: extractInnerSvg(pipSvg),
  pipExit: extractInnerSvg(pipExitSvg),
  fullscreen: extractInnerSvg(fullscreenSvg),
  fullscreenExit: extractInnerSvg(fullscreenExitSvg),
  mnext: extractInnerSvg(nextSvg),
  mprev: extractInnerSvg(prevSvg),
};

const NOOP_ICON_RESOLVER: IVlcIconResolver = () => null;

let demoIconResolver: IVlcIconResolver = NOOP_ICON_RESOLVER;

export function resolveDemoIcon(name: IVlcIconKey): string {
  const customIcon = demoIconResolver(name);
  if (typeof customIcon === 'string' && customIcon.trim().length > 0) {
    return normalizeIconColor(customIcon);
  }
  return VLC_ICONS[name];
}

export function resolveDemoIconSvg(name: IVlcIconKey): string {
  const icon = resolveDemoIcon(name);
  return icon.trim().startsWith('<svg') ? icon : wrapSvg(icon);
}

export function populateSvgIcons(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon') as IVlcIconKey;
    if (name && name in VLC_ICONS) {
      el.innerHTML = el instanceof SVGElement ? resolveDemoIcon(name) : resolveDemoIconSvg(name);
    }
  });
}

export function setIVlcIconResolver(resolver: IVlcIconResolver | null | undefined): void {
  demoIconResolver = resolver ?? NOOP_ICON_RESOLVER;
  populateSvgIcons(document);
}

export function resetIVlcIconResolver(): void {
  setIVlcIconResolver(null);
}

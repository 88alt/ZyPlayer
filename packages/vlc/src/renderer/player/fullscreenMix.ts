import { addClass, append, hasClass, removeClass, setStyle } from '../utils/dom';
import { def } from '../utils/property';

export default function fullscreenMix(vlc: any) {
  const {
    constructor,
    template: { $container, $player },
  } = vlc;

  let cssText = '';

  function requestBrowserFullscreen(): void {
    const el = $player as HTMLElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  }

  function exitBrowserFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  }

  function isBrowserFullscreen(): boolean {
    const fullEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    return fullEl === $player;
  }

  def(vlc, 'fullscreenWeb', {
    get() {
      return isBrowserFullscreen() || hasClass($player, 'vlc-fullscreen-web');
    },
    set(value) {
      if (value) {
        cssText = $player.style.cssText;
        if (constructor.FULLSCREEN_WEB_IN_BODY) {
          append(document.body, $player);
        }
        vlc.state = 'fullscreenWeb';
        setStyle($player, 'width', '100%');
        setStyle($player, 'height', '100%');
        addClass($player, 'vlc-fullscreen-web');
        requestBrowserFullscreen();
        vlc.emit('fullscreenWeb', true);
      } else {
        if (isBrowserFullscreen()) {
          exitBrowserFullscreen();
        }
        if (constructor.FULLSCREEN_WEB_IN_BODY) {
          append($container, $player);
        }
        if (cssText) {
          $player.style.cssText = cssText;
          cssText = '';
        }
        removeClass($player, 'vlc-fullscreen-web');
        vlc.emit('fullscreen', false);
      }

      vlc.emit('resize');
    },
  });

  // Handle Esc key or other browser-initiated fullscreen exit
  function onFullscreenChange(): void {
    if (!isBrowserFullscreen()) {
      if (constructor.FULLSCREEN_WEB_IN_BODY) {
        append($container, $player);
      }
      if (cssText) {
        $player.style.cssText = cssText;
        cssText = '';
      }
      removeClass($player, 'vlc-fullscreen-web');
      vlc.emit('fullscreen', false);
      vlc.emit('resize');
    }
  }

  $player.addEventListener('fullscreenchange', onFullscreenChange);
  $player.addEventListener('webkitfullscreenchange', onFullscreenChange);
}

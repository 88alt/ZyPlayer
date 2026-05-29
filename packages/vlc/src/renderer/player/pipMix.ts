import { def } from '../utils/property';

export default function pipMix(vlc: any) {
  const { notice, proxy } = vlc;

  const pipSupported =
    typeof document !== 'undefined' &&
    typeof document.pictureInPictureEnabled === 'boolean' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype;

  // Hidden video element for PiP
  const pipVideo = document.createElement('video');
  pipVideo.muted = true;
  pipVideo.playsInline = true;
  pipVideo.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
  document.body.appendChild(pipVideo);

  const pipCanvas = document.createElement('canvas');
  pipCanvas.width = 16;
  pipCanvas.height = 9;
  pipCanvas.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px';
  document.body.appendChild(pipCanvas);
  vlc.pipCanvas = pipCanvas;

  // Capture stream from the hidden PiP canvas
  let pipStream: MediaStream | null = null;
  if (pipSupported && 'captureStream' in HTMLCanvasElement.prototype) {
    pipStream = pipCanvas.captureStream(30);
    pipVideo.srcObject = pipStream;
  }

  def(vlc, 'pip', {
    get() {
      return document.pictureInPictureElement === pipVideo;
    },
    set(value: boolean) {
      if (value) {
        if (!pipSupported || !pipStream) {
          notice.show = 'Picture-in-Picture not supported';
          return;
        }
        pipVideo.srcObject = pipStream;
        vlc.emit('pip', true);
        pipVideo
          .play()
          .then(() => (pipVideo as any).requestPictureInPicture())
          .then(() => vlc.emit('pip', true))
          .catch((err: unknown) => {
            vlc.emit('pip', false);
            console.warn('[pipMix] PiP failed:', err);
            notice.show = 'Picture-in-Picture failed';
          });
      } else {
        if (document.pictureInPictureElement === pipVideo) {
          document.exitPictureInPicture().catch(() => {});
        }
      }
    },
  });

  proxy(pipVideo, 'enterpictureinpicture', () => {
    vlc.emit('pip', true);
  });

  proxy(pipVideo, 'leavepictureinpicture', () => {
    vlc.emit('pip', false);
  });

  // Cleanup on player destroy
  vlc.on('destroy', () => {
    pipStream?.getTracks().forEach((t) => t.stop());
    pipCanvas.remove();
    pipVideo.remove();
  });

  def(vlc, 'pipEnabled', {
    get() {
      return vlc.pip;
    },
  });
}

import { def } from '../utils/property';

export default function pauseMix(vlc: any) {
  const {
    template: { $video },
    i18n,
    notice,
  } = vlc;

  def(vlc, 'pause', {
    value() {
      const result = $video.pause();
      notice.show = i18n.get('actionPause');
      vlc.emit('pause');
      return result;
    },
  });
}

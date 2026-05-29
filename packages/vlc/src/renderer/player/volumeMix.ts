import { clamp } from '../utils/format';
import { def } from '../utils/property';

export default function volumeMix(vlc: any) {
  const {
    template: { $video },
    i18n,
    notice,
    storage,
  } = vlc;

  def(vlc, 'volume', {
    get: () => $video.volume || 0,
    set: (percentage) => {
      $video.volume = clamp(percentage, 0, 1);
      notice.show = `${i18n.get('labelVolume')}: ${Math.round($video.volume * 100)}`;
      if ($video.volume !== 0) {
        storage.set('volume', $video.volume);
      }
      vlc.emit('volume', $video.volume);
    },
  });

  def(vlc, 'muted', {
    get: () => $video.muted,
    set: (muted) => {
      $video.muted = muted;
      storage.set('muted', muted);
      vlc.emit('muted', muted);
    },
  });
}

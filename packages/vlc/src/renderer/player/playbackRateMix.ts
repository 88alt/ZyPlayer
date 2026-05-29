import { def } from '../utils/property';

export default function playbackRateMix(vlc: any) {
  const {
    template: { $video },
    i18n,
    notice,
    storage,
  } = vlc;

  def(vlc, 'playbackRate', {
    get() {
      return $video.playbackRate;
    },
    set(rate) {
      if (rate) {
        if (rate === $video.playbackRate) return;
        $video.playbackRate = rate;
        storage.set('playrate', rate);
        notice.show = `${i18n.get('labelPlaybackRate')}: ${rate}x`;
        vlc.emit('playbackRate', rate);
      } else {
        vlc.playbackRate = 1;
      }
    },
  });
}

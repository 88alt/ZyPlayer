import { clamp } from '../utils/format';
import { def } from '../utils/property';

export default function currentTimeMix(vlc: any) {
  const { $video } = vlc.template;

  def(vlc, 'currentTime', {
    get: () => $video.currentTime || 0,
    set: (time) => {
      time = Number.parseFloat(time);
      if (Number.isNaN(time) || time < 0) return;
      $video.currentTime = clamp(time, 0, vlc.duration);
    },
  });
}

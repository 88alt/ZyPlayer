import { def } from '../utils/property';

export default function durationMix(vlc: any) {
  def(vlc, 'duration', {
    get: () => {
      const { duration } = vlc.template.$video;
      if (duration === -1) return 0;
      return duration || 0;
    },
  });
}

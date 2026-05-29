import { def } from '../utils/property';

export default function toggleMix(vlc: any) {
  def(vlc, 'toggle', {
    value() {
      if (vlc.playing) {
        return vlc.pause();
      } else {
        return vlc.play();
      }
    },
  });
}

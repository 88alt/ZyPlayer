import { def } from '../utils/property';

export default function playedMix(vlc: any) {
  def(vlc, 'played', {
    get: () => vlc.currentTime / vlc.duration,
  });
}

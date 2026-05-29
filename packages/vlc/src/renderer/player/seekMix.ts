import { secondToTime } from '../utils/format';
import { def } from '../utils/property';

export default function seekMix(vlc: any) {
  const { notice } = vlc;

  def(vlc, 'seek', {
    set(time) {
      vlc.currentTime = time;
      if (vlc.duration) {
        notice.show = `${secondToTime(vlc.currentTime)} / ${secondToTime(vlc.duration)}`;
      }
      vlc.emit('seek', vlc.currentTime, time);
    },
  });

  def(vlc, 'forward', {
    set(time) {
      vlc.seek = vlc.currentTime + time;
    },
  });

  def(vlc, 'backward', {
    set(time) {
      vlc.seek = vlc.currentTime - time;
    },
  });
}

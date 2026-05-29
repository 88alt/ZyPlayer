import { capitalize } from '../utils/format';
import { def } from '../utils/property';

export default function flipMix(vlc: any) {
  const {
    template: { $player },
    i18n,
    notice,
  } = vlc;

  def(vlc, 'flip', {
    get() {
      return $player.dataset.flip || 'normal';
    },
    set(flip) {
      if (!flip) flip = 'normal';
      if (flip === 'normal') {
        delete $player.dataset.flip;
      } else {
        $player.dataset.flip = flip;
      }

      notice.show = `${i18n.get('Video Flip')}: ${i18n.get(capitalize(flip))}`;
      vlc.emit('flip', flip);
    },
  });
}

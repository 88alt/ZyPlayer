import { def } from '../utils/property';

export default function playMix(vlc: any) {
  const {
    i18n,
    notice,
    option,
    constructor: { instances },
    template: { $video },
  } = vlc;

  def(vlc, 'play', {
    async value() {
      const result = await $video.play();
      notice.show = i18n.get('actionPlay');
      vlc.emit('play');

      if (option.mutex) {
        for (let index = 0; index < instances.length; index++) {
          const instance = instances[index];
          if (instance !== vlc) {
            instance.pause();
          }
        }
      }

      return result;
    },
  });
}

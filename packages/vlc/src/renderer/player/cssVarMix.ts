import { def } from '../utils/property';

export default function cssVarMix(vlc: any) {
  const { $player } = vlc.template;

  def(vlc, 'cssVar', {
    value(key: string, value?: string) {
      if (value) {
        return $player.style.setProperty(key, value);
      } else {
        return getComputedStyle($player).getPropertyValue(key);
      }
    },
  });
}

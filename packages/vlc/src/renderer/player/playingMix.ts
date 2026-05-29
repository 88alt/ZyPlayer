import { def } from '../utils/property';

export default function playingMix(vlc: any) {
  const { $video } = vlc.template;
  def(vlc, 'playing', {
    get: () => {
      if (typeof $video.playing === 'boolean') return $video.playing;
      return !!($video.currentTime > 0 && !$video.paused && !$video.ended && $video.readyState > 2);
    },
  });
}

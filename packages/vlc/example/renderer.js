import { VlcPlayer } from '../lib/renderer.mjs';

const vlcPath = {
  libPath: '/Applications/VLC.app/Contents/MacOS/lib/libvlc.dylib',
  pluginPath: '/Applications/VLC.app/Contents/MacOS/plugins',
};

// Player 1
void new VlcPlayer(vlcPath, {
  el: '#app-1',
  url: 'https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-360p.mp4',
  // debug: true,
  // autoplay: true,
});

// Player 2
void new VlcPlayer(vlcPath, {
  el: '#app-2',
  locale: 'en-US',
  url: 'https://voddemo-play.volcvod.com/oQ8YhILEoRRtzAJuQfdsDZQ75RZkLxAv9wX0Zr?auth_key=1871887663-4aa8f75738e64f95a56aface7fe12364-0-9ff7de60c93cfd3fc0e08aa9b28733e2',
  autoplay: false,
  volume: 0.7,
  muted: false,
  playbackRate: 1.25,
  playbackRates: [0.75, 1, 1.25],
  seekStep: 5000,
  volumeStep: 0.05,
});

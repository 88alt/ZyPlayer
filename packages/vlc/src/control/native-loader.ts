import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loadNativeAddon = () => {
  const nativePath = '../build/vlc_native.node';

  // Strategy 1: Relative path (works in dev / unbundled)
  if (existsSync(join(__dirname, nativePath))) {
    return createRequire(__filename)(nativePath);
  }

  // Strategy 2: Find @zy/vlc in node_modules from current dir upward (works when bundled)
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    const pkgJson = join(dir, 'node_modules', '@zy', 'vlc', 'package.json');
    if (existsSync(pkgJson)) {
      return createRequire(pkgJson)('./build/vlc_native.node');
    }
    dir = dirname(dir);
  }

  throw new Error(`VLC native addon not found. Searched from: ${__dirname}`);
};

export default loadNativeAddon();

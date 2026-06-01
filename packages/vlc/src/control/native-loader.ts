import { createRequire } from 'node:module';
import { join } from 'node:path';

// Must NOT use "require" as variable name — it shadows CJS built-in require,
// causing TDZ error in the CJS bundle output.
const require = createRequire(import.meta.url);

const pkgPath = require.resolve('@zy/vlc/package.json');
const addon = require(join(pkgPath, '../build/Release/vlc_native.node'));

export default addon;

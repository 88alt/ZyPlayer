import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'tsdown';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    // index: 'src/index.ts',
    control: 'src/control/index.ts',
    // 'subprocess-entry': 'src/control/subprocess-entry.ts',
    renderer: 'src/renderer/index.ts',
    types: 'src/types.ts',
    constants: 'src/constants/index.ts',
  },
  outDir: 'lib',
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  tsconfig: 'tsconfig.json',
  external: [/^\.\.\/build/],
  plugins: [
    {
      name: 'raw-svg',
      resolveId: {
        order: 'pre',
        handler(source) {
          if (source.endsWith('.svg?raw')) return source;
        },
      },
      load(id) {
        if (id.endsWith('.svg?raw')) {
          const fileName = id.replace('?raw', '').replace(/^.*\//, '');
          const filePath = resolve(__dirname, 'src/renderer/icons', fileName);
          return { code: `export default ${JSON.stringify(readFileSync(filePath, 'utf-8'))};`, map: null };
        }
      },
    },
  ],
});

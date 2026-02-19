import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'S2SCore',
      fileName: 's2s-core',
    },
    outDir: 'dist',
    sourcemap: true,
  },
});

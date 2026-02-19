import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // During development, resolve directly to core source for HMR
      's2s-core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});

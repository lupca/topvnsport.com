import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [path.resolve(__dirname, 'src/**/*.test.{ts,tsx}')],
    exclude: ['/app/**', '**/node_modules/**'],
    root: path.resolve(__dirname),
    setupFiles: [path.resolve(__dirname, 'src/test-setup.ts')],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

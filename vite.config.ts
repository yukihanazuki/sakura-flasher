import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  mode: process.env.NODE_ENV || 'development',
  envPrefix: 'VITE_APP_',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    minify: !isDev,
    target: 'chrome140',
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
  logLevel: 'silent',
});

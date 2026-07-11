import { defineConfig } from 'vite';

const port = 1442;

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    open: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 1443,
    strictPort: true,
  },
});

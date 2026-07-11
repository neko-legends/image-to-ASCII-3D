import { defineConfig } from 'vite';

const port = 1470;

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
    port: 1471,
    strictPort: true,
  },
});

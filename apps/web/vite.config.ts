import { defineConfig } from 'vite';

// Port can be overridden via PORT env (set by Agent Studio launcher)
// Default aligns with the Tauri desktop dev URL.
const port = parseInt(process.env.PORT || '1440', 10);

// Don't auto-open browser when launched from Agent Studio (it handles that)
const openBrowser = process.env.LAUNCHED_FROM_STUDIO !== 'true';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port,
    open: openBrowser,
  },
  preview: {
    host: '127.0.0.1',
    port,
  },
});

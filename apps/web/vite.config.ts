import { defineConfig } from 'vite';

// Port can be overridden via PORT env (set by Agent Studio launcher)
// Default aligns with PROJECT_PORT_BASE in orchestrator/.env
const port = parseInt(process.env.PORT || '4000', 10);

// Don't auto-open browser when launched from Agent Studio (it handles that)
const openBrowser = process.env.LAUNCHED_FROM_STUDIO !== 'true';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port,
    open: openBrowser,
  },
  preview: {
    port,
  },
});

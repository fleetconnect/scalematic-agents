import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Ops Center is a single-operator console. It proxies /api to the Express backend on
// 3100 so the SSE stream and REST calls share an origin and need no CORS dance in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5181,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
});

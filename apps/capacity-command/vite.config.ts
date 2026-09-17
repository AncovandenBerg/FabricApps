import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so the built `dist/` folder works wherever it is
  // dropped on the site — root, /capacity-command/, or any deeper path — with
  // no rebuild and no server configuration.
  base: './',
  // Off Vite's default 5173, which collides with other local dev servers, and
  // strict so a clash fails loudly instead of silently moving to another port.
  // Bound to 127.0.0.1 explicitly: the default ("localhost") can bind IPv6-only
  // on Windows while browsers resolve localhost to IPv4 first, which lands you
  // on whatever else holds the IPv4 socket.
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Build de démonstration : charge l'API simulée avant le bundle. */
const demoMock = (): Plugin => ({
  name: 'kalati-demo-mock',
  transformIndexHtml: (html) =>
    html.replace('<head>', '<head><script src="/demo/mock-api.js"></script>'),
});

export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), demoMock()] : [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    // Le client HMR se connecte explicitement en ws sur le même port :
    // évite l'échec de handshake derrière un proxy ou un antivirus local.
    hmr: { protocol: 'ws', host: 'localhost', port: 5173, clientPort: 5173 },
    // Proxy de développement : évite CORS en local en réexposant
    // le backend .NET sous la même origine que le frontend.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
}));

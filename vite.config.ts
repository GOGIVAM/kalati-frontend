import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
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
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendHost = process.env.BACKEND_HOST || 'localhost';
const backendPort = process.env.BACKEND_PORT || '5000';
const backendTarget = `http://${backendHost}:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/conversations': {
        target: backendTarget,
        changeOrigin: true
      },
      '/messages': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true
      },
      '/conversations': {
        target: BACKEND_URL,
        changeOrigin: true
      },
      '/messages': {
        target: BACKEND_URL,
        changeOrigin: true
      }
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const amplifyStubPath = fileURLToPath(new URL('./src/aws-amplify.js', import.meta.url));
const alias = {};
const useRealAmplify = (process.env.USE_REAL_AWS_AMPLIFY || '').toLowerCase() === 'true';

if (!useRealAmplify) {
  alias['aws-amplify'] = amplifyStubPath;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  resolve: {
    alias
  }
});

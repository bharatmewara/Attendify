import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const getProxyTarget = (env) => {
  const explicit = (env.VITE_API_PROXY_TARGET || '').toString().trim();
  if (explicit) {
    return explicit.replace(/\/api\/?$/i, '');
  }

  const apiBaseUrl = (env.VITE_API_BASE_URL || '').toString().trim();
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    try {
      const url = new URL(apiBaseUrl);
      return url.origin;
    } catch {
      return 'http://localhost:4000';
    }
  }

  return 'http://localhost:4000';
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = getProxyTarget(env) || 'http://localhost:4000';
  if (command === 'serve') {
    // Helps confirm where /api and /uploads are being proxied during local dev.
    console.log(`[vite] proxy target: ${target}`);
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

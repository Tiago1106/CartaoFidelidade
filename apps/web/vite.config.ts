import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// The app and the API share one address in development: the browser asks `/v1/...` of the Vite
// server, which forwards it to the API. So there is no CORS, and the refresh cookie (limited to
// `/v1/customer/auth`) belongs to the same origin as the app. `API_URL` comes from the root .env.
export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '').API_URL;
  const proxy = { '/v1': { target: apiUrl || 'http://localhost:3000' } };
  return {
    server: { proxy },
    preview: { proxy },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180.png'],
        manifest: {
          name: 'Freguês',
          short_name: 'Freguês',
          description: 'Quem volta, ganha.',
          lang: 'pt-BR',
          start_url: '/',
          display: 'standalone',
          background_color: '#F7F6F2',
          theme_color: '#F2B84B',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
    },
  };
});

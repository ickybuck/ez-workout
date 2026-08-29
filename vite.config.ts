import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app deploys often and there is no release ceremony, so a stale
      // shell would be confusing. autoUpdate installs the new service worker
      // and takes over as soon as a build lands.
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png'],

      manifest: {
        name: 'ez-workout',
        short_name: 'ez-workout',
        description: 'Workout tracker — templates, live logging, and progress insights.',
        // indigo-600, matching the app's primary colour, so the Android status
        // bar and task switcher do not clash with the UI.
        theme_color: '#4f46e5',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Launchers crop to their own shape; the maskable variant keeps the
          // dumbbell inside the safe area so it is never clipped.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Precache the built shell only. Supabase requests are deliberately
        // NOT cached: EZ-13's queue already owns offline behaviour for writes,
        // and a second caching layer serving stale workout data would be much
        // harder to reason about than either alone.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
      },

      devOptions: {
        // Off in dev: a service worker caching a dev server is a debugging trap.
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

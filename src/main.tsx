import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

/*
 * Reload once when a new build's service worker takes over (EZ-50).
 *
 * Without this the plugin injected a bare registerSW.js that only registered
 * the worker. With registerType 'autoUpdate' the new worker activated at once,
 * but the open page kept running the previous build's JavaScript until the
 * next manual reload. On 2026-11-21 that showed Marilyn a blank page: her
 * reset link opened /reset-password, a route only the new build had, inside
 * the old build. Refreshing fixed it, which is the reload this does for her.
 *
 * In autoUpdate mode registerSW reloads on the worker's "activated" event when
 * it is an update, so a first visit after a deploy flips to the new build
 * straight away. The reset page's URL survives the reload, and the page no
 * longer spends its token on load (EZ-49), so the reload is harmless there.
 */
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

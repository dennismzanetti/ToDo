// v3
import { initStore } from './store.js';
import { initTemplatesPage } from './templates-page.js';
import './theme.js';

// ── Service Worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initStore();
initTemplatesPage();

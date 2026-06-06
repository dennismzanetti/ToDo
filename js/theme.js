/**
 * theme.js
 * Shared theme initialisation — imported by every page entry point.
 * Reads localStorage first (set when user manually toggles), then falls
 * back to the OS prefers-color-scheme media query.  Wires the toggle
 * button found via [data-theme-toggle] so any page gets a working toggle.
 */

const root        = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
const mq          = window.matchMedia('(prefers-color-scheme: dark)');

const SUN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

export function applyTheme(t) {
  root.setAttribute('data-theme', t);
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
  themeToggle.innerHTML = t === 'dark' ? SUN : MOON;
}

// 1. Try saved preference, 2. fall back to system preference
let saved = null;
try { saved = localStorage.getItem('theme'); } catch (_) {}
const initial = saved || (mq.matches ? 'dark' : 'light');
applyTheme(initial);

// Follow system changes only when the user hasn't manually chosen
mq.addEventListener?.('change', () => {
  try { if (localStorage.getItem('theme')) return; } catch (_) {}
  applyTheme(mq.matches ? 'dark' : 'light');
});

// Toggle: save choice to localStorage so all pages stay in sync
themeToggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', next); } catch (_) {}
  applyTheme(next);
});

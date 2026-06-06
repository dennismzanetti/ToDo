import { initStore, subscribe, subscribeTemplates } from './store.js';
import { renderBoard, prevWeek, nextWeek, gotoToday } from './board.js';
import { applyTemplates } from './templates-engine.js';
import { openModal } from './modal.js';

// ── Theme ──────────────────────────────────────────────────────────────────────────
const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
const mq = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(t) {
  root.setAttribute('data-theme', t);
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
  themeToggle.innerHTML = t === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// Restore saved preference, fall back to system preference
let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (_) {}
const initialTheme = savedTheme || (mq.matches ? 'dark' : 'light');
applyTheme(initialTheme);

mq.addEventListener?.('change', () => {
  // Only follow system preference if the user has never manually toggled
  try { if (localStorage.getItem('theme')) return; } catch (_) {}
  applyTheme(mq.matches ? 'dark' : 'light');
});

themeToggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', next); } catch (_) {}
  applyTheme(next);
});

// ── Week nav ─────────────────────────────────────────────────────────────────────
let lastTasks = [];
document.getElementById('prev-week')?.addEventListener('click', () => { prevWeek(); renderBoard(lastTasks); });
document.getElementById('next-week')?.addEventListener('click', () => { nextWeek(); renderBoard(lastTasks); });
document.getElementById('today-btn')?.addEventListener('click', () => { gotoToday(); renderBoard(lastTasks); });
document.getElementById('today-btn-mobile')?.addEventListener('click', () => { gotoToday(); renderBoard(lastTasks); });

// ── Header Add Task button (desktop) ─────────────────────────────────────────────
document.getElementById('header-add-btn')?.addEventListener('click', () => {
  openModal(null);
});

// ── Store ────────────────────────────────────────────────────────────────────────
let tasksReady = false, templatesReady = false;
function maybeApplyTemplates() { if (tasksReady && templatesReady) applyTemplates(); }

subscribe(tasks => {
  lastTasks = tasks;
  renderBoard(tasks);
  if (!tasksReady) { tasksReady = true; maybeApplyTemplates(); }
});

subscribeTemplates(() => {
  if (!templatesReady) { templatesReady = true; maybeApplyTemplates(); }
});

// ── Service Worker ────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initStore();

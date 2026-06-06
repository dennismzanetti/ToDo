import { initStore, subscribe, subscribeTemplates } from './store.js';
import { renderBoard, prevWeek, nextWeek, gotoToday } from './board.js';
import { applyTemplates } from './templates-engine.js';
import { openModal } from './modal.js';
import './theme.js';

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

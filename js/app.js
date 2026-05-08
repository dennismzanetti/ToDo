import { initStore, subscribe } from './store.js';
import { renderBoard, prevWeek, nextWeek, resetWeek } from './board.js';
import { applyTemplates } from './templates-engine.js';

// Theme
const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
let theme = localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
root.setAttribute('data-theme', theme);
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

// Week navigation
document.getElementById('prev-week').addEventListener('click', () => { prevWeek(); renderBoard(lastTasks); });
document.getElementById('next-week').addEventListener('click', () => { nextWeek(); renderBoard(lastTasks); });
document.getElementById('today-btn').addEventListener('click', () => { resetWeek(); renderBoard(lastTasks); });

// Store
let lastTasks = [];
let templatesReady = false;
let tasksReady = false;

subscribe(tasks => {
  lastTasks = tasks;
  renderBoard(tasks);
  if (!tasksReady) {
    tasksReady = true;
    maybeApplyTemplates();
  }
});

function maybeApplyTemplates() {
  if (tasksReady && templatesReady) {
    applyTemplates();
  }
}

import { subscribeTemplates } from './store.js';
subscribeTemplates(() => {
  if (!templatesReady) {
    templatesReady = true;
    maybeApplyTemplates();
  }
});

initStore();

import { initStore, subscribe } from './store.js';
import { renderBoard, prevWeek, nextWeek, resetWeek } from './board.js';
import { applyTemplates } from './templates-engine.js';
import { initTemplatesPage } from './templates-page.js';

// Theme
const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
root.setAttribute('data-theme', theme);
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', theme);
});

// View switching
const views = {
  board: document.getElementById('board'),
  templates: document.getElementById('templates-view')
};
const weekNav = document.getElementById('week-nav');

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('active', key === v);
      el.hidden = key !== v;
    });
    weekNav.classList.toggle('hidden', v !== 'board');
  });
});

// Fix: board starts visible, templates hidden
views.board.hidden = false;
views.templates.hidden = true;

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

// Wait for both tasks and templates to load before applying
import { subscribeTemplates } from './store.js';
subscribeTemplates(() => {
  if (!templatesReady) {
    templatesReady = true;
    maybeApplyTemplates();
  }
});

initStore();
initTemplatesPage();

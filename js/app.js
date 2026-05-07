import { initStore, subscribe } from './store.js';
import { renderBoard, prevWeek, nextWeek, resetWeek, getDays } from './board.js';
import { toDateKey } from './models.js';

// Theme
const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
root.setAttribute('data-theme', theme);

themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', theme);
});

// Week navigation
document.getElementById('prev-week').addEventListener('click', () => {
  prevWeek();
  renderBoard(lastTasks);
});

document.getElementById('next-week').addEventListener('click', () => {
  nextWeek();
  renderBoard(lastTasks);
});

document.getElementById('today-btn').addEventListener('click', () => {
  resetWeek();
  renderBoard(lastTasks);
});

// Store
let lastTasks = [];

subscribe(tasks => {
  lastTasks = tasks;
  renderBoard(tasks);
});

initStore();

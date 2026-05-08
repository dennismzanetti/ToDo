import { initStore } from './store.js';
import { initTemplatesPage } from './templates-page.js';

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

initStore();
initTemplatesPage();

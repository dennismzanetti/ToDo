import { db, collections } from './firebase.js';

const routes = document.querySelectorAll('[data-route]');
const pages = document.querySelectorAll('[data-page]');
const pageTitle = document.getElementById('page-title');
const themeToggle = document.querySelector('[data-theme-toggle]');

const setActivePage = (routeName) => {
  routes.forEach((route) => route.classList.toggle('active', route.dataset.route === routeName));
  pages.forEach((page) => page.classList.toggle('active', page.id === routeName));
  if (pageTitle) pageTitle.textContent = routeName.charAt(0).toUpperCase() + routeName.slice(1);
};

const syncRoute = () => {
  const routeName = window.location.hash.replace('#', '') || 'dashboard';
  setActivePage(routeName);
};

window.addEventListener('hashchange', syncRoute);
syncRoute();

let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

const renderThemeLabel = () => {
  themeToggle.textContent = currentTheme === 'dark' ? 'Light mode' : 'Dark mode';
  themeToggle.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
};

renderThemeLabel();

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  renderThemeLabel();
});

console.log('Firebase ready:', !!db, Object.keys(collections));

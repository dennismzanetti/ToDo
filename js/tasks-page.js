/**
 * tasks-page.js
 * Entry point for todo-list.html.
 * Shows only tasks that have no "Do On" (doOnFrom/doOnTo) dates set —
 * those are unscheduled tasks that don't belong to any board day.
 * Subscribes to the shared store and renders tasks grouped by priority.
 */
import {
  initStore, subscribe, toggleComplete, deleteTask,
  subscribeCategories, addCategory, deleteCategory
} from './store.js';
import { openModal } from './modal.js';
import './theme.js';

// ── State ──────────────────────────────────────────────────────────────────────
let allTasks           = [];
let allCategories      = [];
let activeFilter       = 'all';   // 'all' | 'active' | 'completed'
let activeTab          = 'all';   // 'all' | 'active' | 'completed' | 'categories'
let activeCategoryId   = '';      // '' = all categories

// ── Helpers ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tsToDateStr(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isUnscheduled(task) {
  return !task.doOnFrom && !task.doOnTo;
}

const PRIORITY_ORDER  = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const GROUPS          = ['high', 'medium', 'low'];

// ── SVG icons ──────────────────────────────────────────────────────────────────
const ICON_EDIT  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const taskListEl        = document.getElementById('tasks-list');
const categoriesPanelEl = document.getElementById('categories-panel');
const catFilterRowEl    = document.getElementById('tasks-cat-filter-row');
const pageTitleEl       = document.getElementById('tasks-page-title');
const pageInnerEl       = document.querySelector('.tasks-page-inner');

// ── Sub-tab switching ──────────────────────────────────────────────────────────
function setTab(tab) {
  activeTab = tab;
  const isCatTab = tab === 'categories';

  // Update tab buttons
  document.querySelectorAll('.tasks-subtab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show / hide panels
  taskListEl.hidden        =  isCatTab;
  categoriesPanelEl.hidden = !isCatTab;

  // Float categories panel above the subtab strip when active
  pageInnerEl?.classList.toggle('tasks-page-inner--categories', isCatTab);

  // Category filter row: only when on a task tab AND categories exist
  catFilterRowEl.hidden = isCatTab || allCategories.length === 0;

  // Page title
  const titles = { all: 'All Tasks', active: 'Active Tasks', completed: 'Completed Tasks', categories: 'Categories' };
  if (pageTitleEl) pageTitleEl.textContent = titles[tab] ?? 'Tasks';

  // Keep activeFilter in sync for task tabs
  if (!isCatTab) {
    activeFilter = tab;
    render();
  } else {
    renderCategories();
  }
}

document.querySelectorAll('.tasks-subtab').forEach(btn => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

// ── Category filter dropdown ───────────────────────────────────────────────────
const categoryFilterEl = document.getElementById('tasks-category-filter');
categoryFilterEl?.addEventListener('change', () => {
  activeCategoryId = categoryFilterEl.value;
  render();
});

function syncCategoryFilterOptions() {
  if (!categoryFilterEl) return;
  const current = categoryFilterEl.value;
  categoryFilterEl.innerHTML =
    '<option value="">All</option>' +
    allCategories
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${escHtml(c.id)}"${c.id === current ? ' selected' : ''}>${escHtml(c.name)}</option>`)
      .join('');
  // If current selection was deleted, reset
  if (current && !allCategories.find(c => c.id === current)) {
    activeCategoryId = '';
    categoryFilterEl.value = '';
  }
  // Show/hide the filter row based on tab + whether categories exist
  if (catFilterRowEl) {
    catFilterRowEl.hidden = activeTab === 'categories' || allCategories.length === 0;
  }
}

// ── Add Task button ────────────────────────────────────────────────────────────
document.getElementById('header-add-btn')?.addEventListener('click', () => openModal(null));

// ── Categories panel ───────────────────────────────────────────────────────────
function renderCategories() {
  const container = document.getElementById('category-chips');
  if (!container) return;
  if (allCategories.length === 0) {
    container.innerHTML = '<span class="category-chips-empty">No categories yet. Add one above.</span>';
    return;
  }
  container.innerHTML = '';
  allCategories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'category-chip';
    chip.setAttribute('role', 'listitem');
    chip.innerHTML = `
      <span class="category-chip-name">${escHtml(cat.name)}</span>
      <button class="category-chip-delete" aria-label="Delete category ${escHtml(cat.name)}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="3" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    chip.querySelector('.category-chip-delete').addEventListener('click', () =>
      showCategoryDeleteConfirm(chip, cat.id, cat.name)
    );
    container.appendChild(chip);
  });
}

function showCategoryDeleteConfirm(chip, catId, catName) {
  if (chip.querySelector('.category-chip-confirm')) return;
  const confirm = document.createElement('div');
  confirm.className = 'category-chip-confirm';
  confirm.innerHTML = `
    <span>Delete "${escHtml(catName)}"?</span>
    <button class="category-chip-confirm-yes">Delete</button>
    <button class="category-chip-confirm-no">Cancel</button>`;
  confirm.addEventListener('click', e => e.stopPropagation());
  confirm.querySelector('.category-chip-confirm-yes').addEventListener('click', async () => {
    chip.style.opacity = '0.4';
    chip.style.pointerEvents = 'none';
    await deleteCategory(catId);
  });
  confirm.querySelector('.category-chip-confirm-no').addEventListener('click', () =>
    confirm.remove()
  );
  chip.appendChild(confirm);
}

const categoryNameInput = document.getElementById('category-name-input');
const categoryAddBtn    = document.getElementById('category-add-btn');

async function handleAddCategory() {
  const name = categoryNameInput?.value.trim();
  if (!name) return;
  categoryNameInput.value = '';
  await addCategory({ name });
}
categoryAddBtn?.addEventListener('click', handleAddCategory);
categoryNameInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
});

// ── Delete task with inline confirm ───────────────────────────────────────────
function showDeleteConfirm(row, taskId) {
  if (row.querySelector('.tasks-row-delete-confirm')) return;

  const confirm = document.createElement('div');
  confirm.className = 'tasks-row-delete-confirm';
  confirm.innerHTML = `
    <span>Delete this task?</span>
    <button class="tasks-row-delete-yes" aria-label="Confirm delete">Delete</button>
    <button class="tasks-row-delete-no"  aria-label="Cancel delete">Cancel</button>`;

  confirm.addEventListener('click', e => e.stopPropagation());

  confirm.querySelector('.tasks-row-delete-yes').addEventListener('click', async e => {
    e.stopPropagation();
    row.style.opacity = '0.4';
    row.style.pointerEvents = 'none';
    await deleteTask(taskId);
  });

  confirm.querySelector('.tasks-row-delete-no').addEventListener('click', e => {
    e.stopPropagation();
    confirm.remove();
  });

  row.appendChild(confirm);
}

// ── Render ─────────────────────────────────────────────────────────────────────
function render() {
  const list    = document.getElementById('tasks-list');
  const countEl = document.getElementById('tasks-count');
  if (!list) return;

  const unscheduled = allTasks.filter(isUnscheduled);

  // Stack filters: status then category
  let filtered = unscheduled;
  if (activeFilter === 'active')    filtered = filtered.filter(t => !t.completed);
  if (activeFilter === 'completed') filtered = filtered.filter(t =>  t.completed);
  if (activeCategoryId)             filtered = filtered.filter(t => t.categoryId === activeCategoryId);

  const total     = unscheduled.length;
  const completed = unscheduled.filter(t => t.completed).length;
  if (countEl) {
    countEl.textContent = `${total} task${total !== 1 ? 's' : ''} \u2014 ${completed} completed`;
  }

  if (filtered.length === 0) {
    const messages = {
      completed : 'No completed tasks yet.',
      active    : 'No active tasks \u2014 all done!',
      all       : activeCategoryId
        ? 'No tasks in this category.'
        : 'No unscheduled tasks. Tasks with a \u201cDo On\u201d date appear on the board.',
    };
    list.innerHTML = `
      <div class="tasks-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <p>${messages[activeFilter]}</p>
      </div>`;
    return;
  }

  // Build a quick lookup: categoryId → name
  const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));

  const grouped = Object.fromEntries([...GROUPS, 'none'].map(p => [p, []]));
  filtered.forEach(t => {
    grouped[GROUPS.includes(t.priority) ? t.priority : 'none'].push(t);
  });

  list.innerHTML = '';

  [...GROUPS, 'none'].forEach(priority => {
    const tasks = grouped[priority];
    if (!tasks.length) return;

    const heading = document.createElement('div');
    heading.className = 'tasks-group-heading';
    const label = priority === 'none' ? 'No Priority' : PRIORITY_LABELS[priority];
    heading.innerHTML = `
      <span class="priority-badge ${priority !== 'none' ? priority : ''}">${escHtml(label)}</span>
      <span class="tasks-group-count">${tasks.length}</span>`;
    list.appendChild(heading);

    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = `tasks-row${task.completed ? ' completed' : ''}`;
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `Edit task: ${task.title}`);

      const doneCount  = (task.subtasks || []).filter(s => s.completed).length;
      const totalSubs  = (task.subtasks || []).length;
      const dueDateStr = tsToDateStr(task.dueDate);
      const tagsHtml   = (task.tags || [])
        .map(tag => `<span class="tasks-tag">${escHtml(tag)}</span>`)
        .join('');
      const catName  = task.categoryId ? catMap[task.categoryId] : null;
      const catHtml  = catName
        ? `<span class="tasks-category-chip">${escHtml(catName)}</span>`
        : '';
      const assignedHtml = task.assignedTo
        ? `<span class="assigned-badge">${escHtml(task.assignedTo)}</span>`
        : '';

      row.innerHTML = `
        <button class="task-check${task.completed ? ' checked' : ''}"
                aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
                data-id="${escHtml(task.id)}"></button>
        <span class="tasks-row-title${task.completed ? ' done' : ''}">${escHtml(task.title)}</span>
        <span class="tasks-row-meta">
          ${catHtml}
          ${assignedHtml}
          ${dueDateStr ? `
            <span class="due-date-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
              </svg>
              ${escHtml(dueDateStr)}
            </span>` : ''}
          ${totalSubs ? `<span class="subtask-progress${doneCount === totalSubs ? ' done' : ''}">${doneCount}/${totalSubs}</span>` : ''}
          ${tagsHtml}
        </span>
        <span class="tasks-row-actions">
          <button class="tasks-row-edit-btn"  aria-label="Edit task">${ICON_EDIT}</button>
          <button class="tasks-row-delete-btn" aria-label="Delete task">${ICON_TRASH}</button>
        </span>`;

      row.querySelector('.task-check').addEventListener('click', async e => {
        e.stopPropagation();
        await toggleComplete(task.id, !task.completed);
      });

      row.querySelector('.tasks-row-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        openModal(task);
      });

      row.querySelector('.tasks-row-delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        showDeleteConfirm(row, task.id);
      });

      row.addEventListener('click', () => openModal(task));
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(task); }
      });

      list.appendChild(row);
    });
  });
}

// ── Store subscriptions ────────────────────────────────────────────────────────
subscribe(tasks => {
  allTasks = tasks.slice().sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    return pa !== pb ? pa - pb : (a.order ?? 0) - (b.order ?? 0);
  });
  render();
});

subscribeCategories(cats => {
  allCategories = cats.slice().sort((a, b) => a.name.localeCompare(b.name));
  // If we're on the categories tab, re-render that panel
  if (activeTab === 'categories') renderCategories();
  syncCategoryFilterOptions();
  render();
});

// ── Service Worker ─────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initStore();

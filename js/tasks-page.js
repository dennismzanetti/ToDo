/**
 * tasks-page.js
 * Entry point for todo-list.html.
 * Subscribes to the shared store and renders all tasks grouped by priority.
 */
import { initStore, subscribe, toggleComplete } from './store.js';
import { openModal } from './modal.js';

// ── Theme ──────────────────────────────────────────────────────────────────────
const root        = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
const mq          = window.matchMedia('(prefers-color-scheme: dark)');
let   manualTheme = null;

function applyTheme(t) {
  root.setAttribute('data-theme', t);
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
  themeToggle.innerHTML = t === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

applyTheme(mq.matches ? 'dark' : 'light');
mq.addEventListener?.('change', () => { if (!manualTheme) applyTheme(mq.matches ? 'dark' : 'light'); });
themeToggle?.addEventListener('click', () => {
  manualTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(manualTheme);
});

// ── State ──────────────────────────────────────────────────────────────────────
let allTasks    = [];
let activeFilter = 'all';

// ── Filter bar ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.tasks-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.tasks-filter-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    render();
  });
});

// ── Add Task button ────────────────────────────────────────────────────────────
document.getElementById('header-add-btn')?.addEventListener('click', () => openModal(null));

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

const PRIORITY_ORDER  = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const GROUPS          = ['high', 'medium', 'low'];

// ── Render ─────────────────────────────────────────────────────────────────────
function render() {
  const list    = document.getElementById('tasks-list');
  const countEl = document.getElementById('tasks-count');
  if (!list) return;

  let filtered = allTasks;
  if (activeFilter === 'active')    filtered = allTasks.filter(t => !t.completed);
  if (activeFilter === 'completed') filtered = allTasks.filter(t =>  t.completed);

  const total     = allTasks.length;
  const completed = allTasks.filter(t => t.completed).length;
  if (countEl) {
    countEl.textContent = `${total} task${total !== 1 ? 's' : ''} — ${completed} completed`;
  }

  if (filtered.length === 0) {
    const messages = {
      completed : 'No completed tasks yet.',
      active    : 'No active tasks — all done!',
      all       : 'No tasks yet. Add one to get started.',
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

  // Group tasks by priority
  const grouped = Object.fromEntries([...GROUPS, 'none'].map(p => [p, []]));
  filtered.forEach(t => {
    grouped[GROUPS.includes(t.priority) ? t.priority : 'none'].push(t);
  });

  list.innerHTML = '';

  [...GROUPS, 'none'].forEach(priority => {
    const tasks = grouped[priority];
    if (!tasks.length) return;

    // Group heading
    const heading = document.createElement('div');
    heading.className = 'tasks-group-heading';
    const label = priority === 'none' ? 'No Priority' : PRIORITY_LABELS[priority];
    heading.innerHTML = `
      <span class="priority-badge ${priority !== 'none' ? priority : ''}">${escHtml(label)}</span>
      <span class="tasks-group-count">${tasks.length}</span>`;
    list.appendChild(heading);

    // Task rows
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

      row.innerHTML = `
        <button class="task-check${task.completed ? ' checked' : ''}"
                aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
                data-id="${escHtml(task.id)}"></button>
        <span class="tasks-row-title${task.completed ? ' done' : ''}">${escHtml(task.title)}</span>
        <span class="tasks-row-meta">
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
        </span>`;

      // Checkbox: toggle complete without opening modal
      row.querySelector('.task-check').addEventListener('click', async e => {
        e.stopPropagation();
        await toggleComplete(task.id, !task.completed);
      });

      // Row click: open edit modal
      row.addEventListener('click', () => openModal(task));
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(task); }
      });

      list.appendChild(row);
    });
  });
}

// ── Store subscription ─────────────────────────────────────────────────────────
subscribe(tasks => {
  allTasks = tasks.slice().sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    return pa !== pb ? pa - pb : (a.order ?? 0) - (b.order ?? 0);
  });
  render();
});

// ── Service Worker ─────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initStore();

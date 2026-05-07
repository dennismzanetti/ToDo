import { toDateKey, dateKeyToDate, taskDateKey } from './models.js';
import { addTask, toggleComplete, reorderTask, saveTask, deleteTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];

const board = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function getWeekOffset() { return weekOffset; }

export function getDays() {
  const today = new Date();
  today.setHours(0,0,0,0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + weekOffset * 7);
    return d;
  });
}

export function renderBoard(tasks) {
  currentTasks = tasks;
  const days = getDays();
  const todayKey = toDateKey(new Date());

  weekLabel.textContent = `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} – ${MONTHS[days[6].getMonth()]} ${days[6].getDate()}, ${days[6].getFullYear()}`;

  const cols = ['no-date', ...days.map(toDateKey)];
  const tasksByCol = {};
  cols.forEach(k => tasksByCol[k] = []);

  tasks.forEach(t => {
    const key = taskDateKey(t);
    if (tasksByCol[key]) tasksByCol[key].push(t);
    else if (key !== 'no-date' && !cols.includes(key)) {
      // task is outside current week range, skip rendering
    }
  });

  board.innerHTML = '';

  // No-date column first
  board.appendChild(buildColumn('no-date', null, tasksByCol['no-date'] || [], todayKey));

  // Day columns
  days.forEach(day => {
    const key = toDateKey(day);
    board.appendChild(buildColumn(key, day, tasksByCol[key] || [], todayKey));
  });

  bindDragAndDrop();
}

function buildColumn(key, day, tasks, todayKey) {
  const col = document.createElement('div');
  col.className = 'column' + (key === 'no-date' ? ' no-date' : '');
  col.dataset.colKey = key;

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';
  if (key === 'no-date') {
    header.innerHTML = `<div class="col-day">No Date</div><div class="col-date">—</div><div class="col-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</div>`;
  } else {
    const isToday = key === todayKey;
    header.innerHTML = `<div class="col-day">${DAYS[day.getDay()]}</div><div class="col-date${isToday ? ' today' : ''}">${MONTHS[day.getMonth()]} ${day.getDate()}</div><div class="col-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</div>`;
  }
  col.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'column-body';
  col.appendChild(body);

  tasks.sort((a,b) => (a.order||0) - (b.order||0)).forEach(task => {
    body.appendChild(buildTaskCard(task));
  });

  // Add area
  const addArea = document.createElement('div');
  addArea.className = 'column-add';
  const addBtn = document.createElement('button');
  addBtn.className = 'add-task-btn';
  addBtn.textContent = '+ Add task';
  addArea.appendChild(addBtn);
  col.appendChild(addArea);

  addBtn.addEventListener('click', () => showInlineAdd(col, addArea, key, addBtn));

  return col;
}

function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.draggable = true;

  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length;
  const subtasksTotal = (task.subtasks || []).length;
  const progressHtml = subtasksTotal > 0
    ? `<span class="subtask-progress${subtasksDone === subtasksTotal ? ' done' : ''}">${subtasksDone}/${subtasksTotal}</span>`
    : '';

  const tagsHtml = (task.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');

  card.innerHTML = `
    <div class="task-top">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
    </div>
    <div class="task-meta">
      <span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'medium'}</span>
      ${tagsHtml}
      ${progressHtml}
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });

  card.addEventListener('click', () => openModal(task));

  return card;
}

function showInlineAdd(col, addArea, colKey, addBtn) {
  addBtn.style.display = 'none';
  const form = document.createElement('div');
  form.className = 'inline-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-add-input';
  input.placeholder = 'Task title...';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'inline-confirm-btn';
  confirmBtn.textContent = '↵';
  form.appendChild(input);
  form.appendChild(confirmBtn);
  addArea.insertBefore(form, addBtn);
  input.focus();

  const submit = async () => {
    const title = input.value.trim();
    if (!title) { cancel(); return; }
    let dueDate = null;
    if (colKey !== 'no-date') {
      const d = dateKeyToDate(colKey);
      dueDate = Timestamp.fromDate(d);
    }
    const maxOrder = Math.max(0, ...currentTasks.filter(t => taskDateKey(t) === colKey).map(t => t.order || 0));
    await addTask({ title, dueDate, order: maxOrder + 1000 });
    cancel();
  };

  const cancel = () => {
    form.remove();
    addBtn.style.display = '';
  };

  confirmBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') cancel();
  });
  input.addEventListener('blur', (e) => {
    setTimeout(() => { if (!confirmBtn.matches(':focus')) cancel(); }, 150);
  });
}

// Drag and drop
let dragId = null;

function bindDragAndDrop() {
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.column-body').forEach(b => b.classList.remove('drag-over'));
    });
  });

  document.querySelectorAll('.column-body').forEach(body => {
    body.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      if (!dragId) return;

      const colKey = body.closest('.column').dataset.colKey;
      const cards = [...body.querySelectorAll('.task-card:not(.dragging)')];
      const dropIndex = cards.findIndex(c => {
        const rect = c.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });

      const tasksInCol = currentTasks
        .filter(t => taskDateKey(t) === colKey && t.id !== dragId)
        .sort((a,b) => (a.order||0) - (b.order||0));

      let newOrder;
      if (dropIndex === -1 || dropIndex >= tasksInCol.length) {
        newOrder = (tasksInCol.at(-1)?.order || 0) + 1000;
      } else if (dropIndex === 0) {
        newOrder = (tasksInCol[0]?.order || 1000) / 2;
      } else {
        newOrder = ((tasksInCol[dropIndex - 1]?.order || 0) + (tasksInCol[dropIndex]?.order || 0)) / 2;
      }

      let newDueDate = undefined;
      if (colKey === 'no-date') {
        newDueDate = null;
      } else {
        const d = dateKeyToDate(colKey);
        const { Timestamp: T } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        newDueDate = T.fromDate(d);
      }

      await reorderTask(dragId, newOrder, newDueDate);
      dragId = null;
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function prevWeek() { weekOffset--; }
export function nextWeek() { weekOffset++; }
export function resetWeek() { weekOffset = 0; }

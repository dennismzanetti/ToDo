import { toDateKey, dateKeyToDate, taskDisplayKeys } from './models.js';
import { addTask, toggleComplete, reorderTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];

const board = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  const dayKeys = days.map(toDateKey);
  const cols = ['no-date', ...dayKeys];
  const tasksByCol = {};
  cols.forEach(k => tasksByCol[k] = []);

  // A task with a span appears in every column its date range covers
  tasks.forEach(t => {
    const keys = taskDisplayKeys(t);
    if (keys[0] === 'no-date') {
      tasksByCol['no-date'].push(t);
    } else {
      keys.forEach(k => {
        if (tasksByCol[k]) tasksByCol[k].push(t);
      });
    }
  });

  board.innerHTML = '';
  board.appendChild(buildColumn('no-date', null, tasksByCol['no-date'] || [], todayKey));
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

  const header = document.createElement('div');
  header.className = 'column-header';
  if (key === 'no-date') {
    header.innerHTML = `<div class="col-day">No Date</div><div class="col-date">—</div><div class="col-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</div>`;
  } else {
    const isToday = key === todayKey;
    header.innerHTML = `<div class="col-day">${DAYS[day.getDay()]}</div><div class="col-date${isToday ? ' today' : ''}">${MONTHS[day.getMonth()]} ${day.getDate()}</div><div class="col-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</div>`;
  }
  col.appendChild(header);

  const body = document.createElement('div');
  body.className = 'column-body';
  col.appendChild(body);

  tasks.sort((a,b) => (a.order||0) - (b.order||0)).forEach(task => {
    body.appendChild(buildTaskCard(task, key));
  });

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

function buildTaskCard(task, colKey) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.draggable = true;

  const subtasksDone  = (task.subtasks || []).filter(s => s.completed).length;
  const subtasksTotal = (task.subtasks || []).length;
  const progressHtml  = subtasksTotal > 0
    ? `<span class="subtask-progress${subtasksDone === subtasksTotal ? ' done' : ''}">${subtasksDone}/${subtasksTotal}</span>`
    : '';

  const tagsHtml = (task.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');

  // Due date badge — shown on card when set
  let dueDateHtml = '';
  if (task.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dueDateHtml = `<span class="due-date-badge" title="Due date">📅 ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}</span>`;
  }

  // Span indicator — shown on cards that span multiple days
  const keys = taskDisplayKeys(task);
  const isSpan = keys.length > 1;
  const spanHtml = isSpan ? `<span class="span-badge" title="Spans ${keys.length} days">↔ ${keys.length}d</span>` : '';

  card.innerHTML = `
    <div class="task-top">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
    </div>
    <div class="task-meta">
      <span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'medium'}</span>
      ${tagsHtml}
      ${dueDateHtml}
      ${spanHtml}
      ${progressHtml}
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
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
    let doOnFrom = null;
    if (colKey !== 'no-date') {
      doOnFrom = Timestamp.fromDate(dateKeyToDate(colKey));
    }
    const colTasks = currentTasks.filter(t => {
      const keys = taskDisplayKeys(t);
      return keys.includes(colKey);
    });
    const maxOrder = Math.max(0, ...colTasks.map(t => t.order || 0));
    await addTask({ title, doOnFrom, doOnTo: doOnFrom, order: maxOrder + 1000 });
    cancel();
  };

  const cancel = () => { form.remove(); addBtn.style.display = ''; };

  confirmBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') cancel();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (!confirmBtn.matches(':focus')) cancel(); }, 150);
  });
}

// Drag and drop — dragging updates doOnFrom/doOnTo to a single day
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
      const cards  = [...body.querySelectorAll('.task-card:not(.dragging)')];
      const dropIndex = cards.findIndex(c => {
        const rect = c.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });

      const colTasks = currentTasks
        .filter(t => taskDisplayKeys(t).includes(colKey) && t.id !== dragId)
        .sort((a,b) => (a.order||0) - (b.order||0));

      let newOrder;
      if (dropIndex === -1 || dropIndex >= colTasks.length) {
        newOrder = (colTasks.at(-1)?.order || 0) + 1000;
      } else if (dropIndex === 0) {
        newOrder = (colTasks[0]?.order || 1000) / 2;
      } else {
        newOrder = ((colTasks[dropIndex-1]?.order || 0) + (colTasks[dropIndex]?.order || 0)) / 2;
      }

      const { Timestamp: T } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      let doOnFrom = null, doOnTo = null;
      if (colKey !== 'no-date') {
        const d = T.fromDate(dateKeyToDate(colKey));
        doOnFrom = d; doOnTo = d;
      }

      await reorderTask(dragId, newOrder, doOnFrom, doOnTo);
      dragId = null;
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function prevWeek()  { weekOffset--; }
export function nextWeek()  { weekOffset++; }
export function resetWeek() { weekOffset = 0; }

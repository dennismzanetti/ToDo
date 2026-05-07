import { toDateKey, dateKeyToDate, taskDisplayKeys } from './models.js';
import { addTask, toggleComplete, reorderTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];

const board = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function getDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + weekOffset * 7);
    return d;
  });
}

export function renderBoard(tasks) {
  currentTasks = tasks;
  const days     = getDays();
  const todayKey = toDateKey(new Date());
  const dayKeys  = days.map(toDateKey);
  // col indices: 0 = no-date, 1–7 = day columns
  const allKeys  = ['no-date', ...dayKeys];

  weekLabel.textContent =
    `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} – ` +
    `${MONTHS[days[6].getMonth()]} ${days[6].getDate()}, ${days[6].getFullYear()}`;

  // Separate spanning vs single-day tasks
  const spanTasks   = [];  // visible on 2+ board columns this week
  const singleTasks = {};  // keyed by column
  allKeys.forEach(k => (singleTasks[k] = []));

  tasks.forEach(t => {
    const keys = taskDisplayKeys(t);
    if (keys[0] === 'no-date') {
      singleTasks['no-date'].push(t);
      return;
    }
    // Which of this week's columns does the task touch?
    const visibleKeys = keys.filter(k => allKeys.includes(k));
    if (visibleKeys.length > 1) {
      spanTasks.push({ task: t, visibleKeys });
    } else if (visibleKeys.length === 1) {
      singleTasks[visibleKeys[0]].push(t);
    } else {
      // Task exists but falls outside the visible week — skip
    }
  });

  // ── Build board ────────────────────────────────────────────────────────────
  board.innerHTML = '';

  // CSS grid: 8 columns (no-date + 7 days), rows grow with content
  // Row 1: headers
  // Row 2: span-row (spanning cards live here)
  // Row 3+: per-column bodies + add buttons (each col is an independent flex stack)

  // Column headers
  const headerRow = document.createElement('div');
  headerRow.className = 'board-header-row';
  [null, ...days].forEach((day, i) => {
    const hdr = document.createElement('div');
    hdr.className = 'column-header';
    if (i === 0) {
      hdr.innerHTML = `<div class="col-day">No Date</div><div class="col-date">—</div>`;
    } else {
      const key = toDateKey(day);
      const isToday = key === todayKey;
      hdr.innerHTML =
        `<div class="col-day">${DAYS[day.getDay()]}</div>` +
        `<div class="col-date${isToday ? ' today' : ''}">${MONTHS[day.getMonth()]} ${day.getDate()}</div>`;
    }
    headerRow.appendChild(hdr);
  });
  board.appendChild(headerRow);

  // Span row — grid row where multi-day cards live
  const spanRow = document.createElement('div');
  spanRow.className = 'board-span-row';
  // Render multi-day cards
  spanTasks.forEach(({ task, visibleKeys }) => {
    const startIdx = allKeys.indexOf(visibleKeys[0]);   // 1-based grid col
    const endIdx   = allKeys.indexOf(visibleKeys[visibleKeys.length - 1]);
    const card = buildSpanCard(task, visibleKeys.length);
    card.style.gridColumn = `${startIdx + 1} / ${endIdx + 2}`;
    spanRow.appendChild(card);
  });
  board.appendChild(spanRow);

  // Per-column bodies
  const bodyRow = document.createElement('div');
  bodyRow.className = 'board-body-row';
  allKeys.forEach((key, i) => {
    const col = document.createElement('div');
    col.className = 'column-body-wrap' + (key === 'no-date' ? ' no-date' : '');
    col.dataset.colKey = key;

    const body = document.createElement('div');
    body.className = 'column-body';
    col.appendChild(body);

    (singleTasks[key] || []).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(task => {
      body.appendChild(buildTaskCard(task));
    });

    const addArea = document.createElement('div');
    addArea.className = 'column-add';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-btn';
    addBtn.textContent = '+ Add task';
    addArea.appendChild(addBtn);
    col.appendChild(addArea);

    addBtn.addEventListener('click', () => showInlineAdd(col, addArea, key, addBtn));
    bodyRow.appendChild(col);
  });
  board.appendChild(bodyRow);

  bindDragAndDrop();
}

// ── Card builders ─────────────────────────────────────────────────────────────

function metaHtml(task) {
  const subtasksDone  = (task.subtasks || []).filter(s => s.completed).length;
  const subtasksTotal = (task.subtasks || []).length;
  const progressHtml  = subtasksTotal > 0
    ? `<span class="subtask-progress${subtasksDone === subtasksTotal ? ' done' : ''}">${subtasksDone}/${subtasksTotal}</span>`
    : '';
  const tagsHtml = (task.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');
  let dueDateHtml = '';
  if (task.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    dueDateHtml = `<span class="due-date-badge" title="Due date">📅 ${MONTHS[d.getMonth()]} ${d.getDate()}</span>`;
  }
  return `${tagsHtml}${dueDateHtml}${progressHtml}`;
}

/** Single-day card (unchanged visual) */
function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.draggable = true;

  card.innerHTML = `
    <div class="task-top">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
    </div>
    <div class="task-meta">
      <span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'medium'}</span>
      ${metaHtml(task)}
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));
  return card;
}

/** Spanning card — wide pill that stretches across columns */
function buildSpanCard(task, spanDays) {
  const card = document.createElement('div');
  card.className = 'task-card span-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const priorityClass = task.priority || 'medium';

  card.innerHTML = `
    <div class="span-card-inner">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
      <span class="priority-badge ${priorityClass}">${priorityClass}</span>
      ${metaHtml(task)}
      <span class="span-days-badge">${spanDays}d</span>
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));
  return card;
}

// ── Inline add ────────────────────────────────────────────────────────────────

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
    const colTasks = currentTasks.filter(t => taskDisplayKeys(t).includes(colKey));
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

// ── Drag & drop (single-day cards only) ───────────────────────────────────────

let dragId = null;

function bindDragAndDrop() {
  document.querySelectorAll('.task-card:not(.span-card)').forEach(card => {
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

      const colKey = body.closest('.column-body-wrap').dataset.colKey;
      const cards  = [...body.querySelectorAll('.task-card:not(.dragging)')];
      const dropIndex = cards.findIndex(c => {
        const rect = c.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });

      const colTasks = currentTasks
        .filter(t => taskDisplayKeys(t).includes(colKey) && t.id !== dragId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      let newOrder;
      if (dropIndex === -1 || dropIndex >= colTasks.length) {
        newOrder = (colTasks.at(-1)?.order || 0) + 1000;
      } else if (dropIndex === 0) {
        newOrder = (colTasks[0]?.order || 1000) / 2;
      } else {
        newOrder = ((colTasks[dropIndex - 1]?.order || 0) + (colTasks[dropIndex]?.order || 0)) / 2;
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
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function prevWeek()  { weekOffset--; }
export function nextWeek()  { weekOffset++; }
export function resetWeek() { weekOffset = 0; }

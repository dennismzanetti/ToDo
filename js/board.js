import { toDateKey, dateKeyToDate, taskDisplayKeys } from './models.js';
import { addTask, toggleComplete, reorderTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];

const board     = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Tooltip singleton (desktop only) ───────────────────────────────────────
const tooltip = document.createElement('div');
tooltip.className = 'notes-tooltip';
tooltip.setAttribute('role', 'tooltip');
document.body.appendChild(tooltip);

let tooltipTimer = null;

function showTooltip(text, anchorEl) {
  clearTimeout(tooltipTimer);
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  positionTooltip(anchorEl);
}

function hideTooltip() {
  tooltipTimer = setTimeout(() => tooltip.classList.remove('visible'), 80);
}

function positionTooltip(el) {
  const rect   = el.getBoundingClientRect();
  const gap    = 8;
  const indent = 20;
  let top  = rect.bottom + gap;
  let left = rect.left + indent;
  tooltip.style.left = '0px';
  tooltip.style.top  = `${top}px`;
  const tWidth  = tooltip.offsetWidth;
  const maxLeft = window.innerWidth - tWidth - 8;
  left = Math.max(8, Math.min(left, maxLeft));
  tooltip.style.left = `${left}px`;
}

// Only attach tooltip on pointer-with-hover devices (not iOS)
function attachNoteTooltip(el, notes) {
  if (!notes || !notes.trim()) return;
  el.classList.add('has-notes');
  if (window.matchMedia('(hover: hover)').matches) {
    el.addEventListener('mouseenter', () => showTooltip(notes, el));
    el.addEventListener('mouseleave', hideTooltip);
  }
}

// ── Week / render ────────────────────────────────────────────────────────────

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
  const allKeys  = ['no-date', ...dayKeys];

  weekLabel.textContent =
    `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} – ` +
    `${MONTHS[days[6].getMonth()]} ${days[6].getDate()}, ${days[6].getFullYear()}`;

  const spanTasks   = [];
  const singleTasks = {};
  allKeys.forEach(k => (singleTasks[k] = []));

  tasks.forEach(t => {
    const keys = taskDisplayKeys(t);
    if (keys[0] === 'no-date') { singleTasks['no-date'].push(t); return; }
    const visibleKeys = keys.filter(k => allKeys.includes(k));
    if (visibleKeys.length > 1) {
      spanTasks.push({ task: t, visibleKeys });
    } else if (visibleKeys.length === 1) {
      singleTasks[visibleKeys[0]].push(t);
    }
  });

  board.innerHTML = '';

  // ── Header row ──
  const headerRow = document.createElement('div');
  headerRow.className = 'board-header-row';

  // No-date column header
  const noDateHdr = document.createElement('div');
  noDateHdr.className = 'column-header no-date-header';
  noDateHdr.dataset.col = 'no-date';
  noDateHdr.innerHTML = `<div class="col-day">No Date</div><div class="col-date">—</div>`;
  headerRow.appendChild(noDateHdr);

  days.forEach(day => {
    const key = toDateKey(day);
    const isToday   = key === todayKey;
    const dayIdx    = day.getDay(); // 0=Sun,6=Sat
    const isWeekend = dayIdx === 0 || dayIdx === 6;
    const dayName   = DAYS[dayIdx].toLowerCase();

    const hdr = document.createElement('div');
    hdr.className = 'column-header' +
      (isToday   ? ' is-today'   : '') +
      (isWeekend ? ' is-weekend' : ' is-weekday');
    hdr.dataset.col = dayName;
    hdr.innerHTML =
      `<div class="col-day">${DAYS[dayIdx]}</div>` +
      `<div class="col-date${isToday ? ' today' : ''}">${MONTHS[day.getMonth()]} ${day.getDate()}</div>`;
    headerRow.appendChild(hdr);
  });
  board.appendChild(headerRow);

  // ── Span row ──
  const spanRow = document.createElement('div');
  spanRow.className = 'board-span-row';
  spanTasks.forEach(({ task, visibleKeys }) => {
    const startIdx = allKeys.indexOf(visibleKeys[0]);
    const endIdx   = allKeys.indexOf(visibleKeys[visibleKeys.length - 1]);
    const card = buildSpanCard(task, visibleKeys.length);
    card.style.gridColumn = `${startIdx + 1} / ${endIdx + 2}`;
    spanRow.appendChild(card);
  });
  board.appendChild(spanRow);

  // ── Body row ──
  const bodyRow = document.createElement('div');
  bodyRow.className = 'board-body-row';

  allKeys.forEach((key, colIndex) => {
    const col = document.createElement('div');
    let dayName = 'no-date';
    let isWeekend = false;
    let isToday = false;

    if (key !== 'no-date') {
      const day = days[colIndex - 1];
      const dayIdx = day.getDay();
      isWeekend = dayIdx === 0 || dayIdx === 6;
      isToday   = key === todayKey;
      dayName   = DAYS[dayIdx].toLowerCase();
    }

    col.className = 'column-body-wrap' +
      (key === 'no-date' ? ' no-date' : '') +
      (isWeekend ? ' is-weekend' : '') +
      (isToday   ? ' is-today'   : '');
    col.dataset.colKey = key;
    col.dataset.col    = dayName;

    const addArea = document.createElement('div');
    addArea.className = 'column-add';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-btn';
    addBtn.textContent = '+ Add task';
    addArea.appendChild(addBtn);
    col.appendChild(addArea);

    const body = document.createElement('div');
    body.className = 'column-body';
    col.appendChild(body);

    (singleTasks[key] || []).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(task => {
      body.appendChild(buildTaskCard(task));
    });

    addBtn.addEventListener('click', () => showInlineAdd(col, addArea, key, addBtn));
    bodyRow.appendChild(col);
  });
  board.appendChild(bodyRow);

  bindDragAndDrop();
}

// ── Card builders ────────────────────────────────────────────────────────────

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

function buildTaskCard(task) {
  const card = document.createElement('div');
  const priority = task.priority || 'medium';
  card.className = `task-card priority-${priority}` + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.draggable = true;

  const notesIcon = task.notes && task.notes.trim()
    ? `<span class="notes-icon" aria-label="Has notes">📝</span>`
    : '';

  card.innerHTML = `
    <div class="task-top">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
      ${notesIcon}
    </div>
    <div class="task-meta">
      <span class="priority-badge ${priority}">${priority}</span>
      ${metaHtml(task)}
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));

  attachNoteTooltip(card, task.notes);
  return card;
}

function buildSpanCard(task, spanDays) {
  const card = document.createElement('div');
  const priority = task.priority || 'medium';
  card.className = `task-card span-card priority-${priority}` + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const notesIcon = task.notes && task.notes.trim()
    ? `<span class="notes-icon" aria-label="Has notes">📝</span>`
    : '';

  card.innerHTML = `
    <div class="span-card-inner">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
      <span class="task-title">${escHtml(task.title)}</span>
      <span class="priority-badge ${priority}">${priority}</span>
      ${metaHtml(task)}
      ${notesIcon}
      <span class="span-days-badge">${spanDays}d</span>
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));

  attachNoteTooltip(card, task.notes);
  return card;
}

// ── Inline add ───────────────────────────────────────────────────────────────

function showInlineAdd(col, addArea, colKey, addBtn) {
  addBtn.style.display = 'none';
  const form = document.createElement('div');
  form.className = 'inline-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-add-input';
  input.placeholder = 'Task title...';
  // font-size >= 16px prevents iOS zoom on focus
  input.style.fontSize = '16px';
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
    if (colKey !== 'no-date') doOnFrom = Timestamp.fromDate(dateKeyToDate(colKey));
    const colTasks = currentTasks.filter(t => taskDisplayKeys(t).includes(colKey));
    const minOrder = Math.min(0, ...colTasks.map(t => t.order || 0));
    await addTask({ title, doOnFrom, doOnTo: doOnFrom, order: minOrder - 1000 });
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

// ── Drag & Drop (mouse) + Touch-based reorder (iOS) ──────────────────────────

let dragId = null;

// Touch drag state
let touchDragId   = null;
let touchClone    = null;
let touchStartX   = 0;
let touchStartY   = 0;
let touchDragging = false;
const TOUCH_DRAG_THRESHOLD = 8; // px before activating drag

function findDropTarget(x, y) {
  // Hide clone so elementFromPoint works
  if (touchClone) touchClone.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (touchClone) touchClone.style.display = '';
  return el?.closest('.column-body');
}

function getDropIndex(body, y) {
  const cards = [...body.querySelectorAll('.task-card:not(.touch-dragging)')];
  return cards.findIndex(c => {
    const rect = c.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  });
}

async function commitTouchDrop(body, dropIndex) {
  if (!touchDragId || !body) return;
  const colKey   = body.closest('.column-body-wrap').dataset.colKey;
  const colTasks = currentTasks
    .filter(t => taskDisplayKeys(t).includes(colKey) && t.id !== touchDragId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

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
  await reorderTask(touchDragId, newOrder, doOnFrom, doOnTo);
}

function bindDragAndDrop() {
  // ── Mouse drag (desktop) ──
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

    // ── Touch drag (iOS / mobile) ──
    card.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchDragId   = card.dataset.taskId;
      touchStartX   = t.clientX;
      touchStartY   = t.clientY;
      touchDragging = false;
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!touchDragId) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      if (!touchDragging && Math.sqrt(dx*dx + dy*dy) > TOUCH_DRAG_THRESHOLD) {
        touchDragging = true;
        card.classList.add('touch-dragging', 'dragging');

        // Create floating ghost clone
        touchClone = card.cloneNode(true);
        touchClone.style.cssText = `
          position:fixed; z-index:999;
          width:${card.offsetWidth}px;
          opacity:0.85;
          pointer-events:none;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          transform: scale(1.03);
          left:${card.getBoundingClientRect().left}px;
          top:${card.getBoundingClientRect().top}px;
          transition: none;
        `;
        document.body.appendChild(touchClone);
      }

      if (touchDragging) {
        e.preventDefault(); // prevent page scroll during drag
        touchClone.style.left = `${t.clientX - card.offsetWidth / 2}px`;
        touchClone.style.top  = `${t.clientY - 20}px`;

        // Highlight target column
        document.querySelectorAll('.column-body').forEach(b => b.classList.remove('drag-over'));
        const target = findDropTarget(t.clientX, t.clientY);
        if (target) target.classList.add('drag-over');
      }
    }, { passive: false });

    card.addEventListener('touchend', async e => {
      if (!touchDragId) return;

      if (touchDragging) {
        const t = e.changedTouches[0];
        const target = findDropTarget(t.clientX, t.clientY);
        const dropIndex = target ? getDropIndex(target, t.clientY) : -1;

        // Clean up visual state
        card.classList.remove('touch-dragging', 'dragging');
        touchClone?.remove();
        document.querySelectorAll('.column-body').forEach(b => b.classList.remove('drag-over'));

        if (target) await commitTouchDrop(target, dropIndex);
      }

      touchDragId   = null;
      touchClone    = null;
      touchDragging = false;
    });

    card.addEventListener('touchcancel', () => {
      card.classList.remove('touch-dragging', 'dragging');
      touchClone?.remove();
      document.querySelectorAll('.column-body').forEach(b => b.classList.remove('drag-over'));
      touchDragId = null; touchClone = null; touchDragging = false;
    });
  });

  // ── Mouse drop targets ──
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

      const colKey  = body.closest('.column-body-wrap').dataset.colKey;
      const cards   = [...body.querySelectorAll('.task-card:not(.dragging)')];
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
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function prevWeek()  { weekOffset--; }
export function nextWeek()  { weekOffset++; }
export function resetWeek() { weekOffset = 0; }

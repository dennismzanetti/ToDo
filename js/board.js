import { toDateKey, dateKeyToDate, taskDisplayKeys } from './models.js';
import { addTask, toggleComplete, reorderTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];
let mobileDayOffset = 0; // 0 = today, -1 = yesterday, etc.

const board     = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Mobile detection ─────────────────────────────────────────────────────────
function isMobile() {
  return window.innerWidth < 768;
}

// ── Tooltip singleton (desktop only) ─────────────────────────────────────────
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

function attachNoteTooltip(el, notes) {
  if (!notes || !notes.trim()) return;
  el.classList.add('has-notes');
  if (window.matchMedia('(hover: hover)').matches) {
    el.addEventListener('mouseenter', () => showTooltip(notes, el));
    el.addEventListener('mouseleave', hideTooltip);
  }
}

// ── Week / date helpers ───────────────────────────────────────────────────────

export function getDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + weekOffset * 7);
    return d;
  });
}

function getMobileDays() {
  // Show 7 days centered on today+mobileDayOffset
  const center = new Date();
  center.setHours(0, 0, 0, 0);
  center.setDate(center.getDate() + mobileDayOffset);
  // Build a strip of 7 days: 3 before, center, 3 after
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(center);
    d.setDate(center.getDate() + (i - 3));
    return d;
  });
}

// ── Main render entry point ───────────────────────────────────────────────────

export function renderBoard(tasks) {
  currentTasks = tasks;
  if (isMobile()) {
    renderMobileBoard(tasks);
  } else {
    renderDesktopBoard(tasks);
  }
}

// ── Re-render on resize ───────────────────────────────────────────────────────
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => renderBoard(currentTasks), 150);
});

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE BOARD
// ══════════════════════════════════════════════════════════════════════════════

function renderMobileBoard(tasks) {
  board.innerHTML = '';
  board.className = 'board board--mobile';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  const activeDay = new Date(today);
  activeDay.setDate(today.getDate() + mobileDayOffset);
  const activeDayKey = toDateKey(activeDay);

  // ── Day picker strip ──────────────────────────────────────────────────────
  const strip = document.createElement('div');
  strip.className = 'mobile-day-strip';

  // Navigation arrows
  const prevBtn = document.createElement('button');
  prevBtn.className = 'mobile-nav-arrow';
  prevBtn.setAttribute('aria-label', 'Previous day');
  prevBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  prevBtn.addEventListener('click', () => { mobileDayOffset--; renderMobileBoard(currentTasks); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'mobile-nav-arrow';
  nextBtn.setAttribute('aria-label', 'Next day');
  nextBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  nextBtn.addEventListener('click', () => { mobileDayOffset++; renderMobileBoard(currentTasks); });

  // Day pill buttons
  const pillsWrap = document.createElement('div');
  pillsWrap.className = 'mobile-day-pills';

  getMobileDays().forEach((d, i) => {
    const key = toDateKey(d);
    const isActive  = key === activeDayKey;
    const isToday   = key === todayKey;
    const pill = document.createElement('button');
    pill.className = 'mobile-day-pill' +
      (isActive  ? ' active'    : '') +
      (isToday   ? ' is-today'  : '');
    pill.setAttribute('aria-label', `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`);
    pill.innerHTML =
      `<span class="pill-day">${DAYS[d.getDay()]}</span>` +
      `<span class="pill-date">${d.getDate()}</span>`;
    const offset = mobileDayOffset + (i - 3);
    pill.addEventListener('click', () => { mobileDayOffset = offset; renderMobileBoard(currentTasks); });
    pillsWrap.appendChild(pill);
  });

  strip.appendChild(prevBtn);
  strip.appendChild(pillsWrap);
  strip.appendChild(nextBtn);
  board.appendChild(strip);

  // ── Active day heading ────────────────────────────────────────────────────
  const heading = document.createElement('div');
  heading.className = 'mobile-day-heading';
  const isActiveTodayDay = activeDayKey === todayKey;
  heading.innerHTML =
    `<span class="mobile-day-name${isActiveTodayDay ? ' is-today' : ''}">${DAYS[activeDay.getDay()]}</span>` +
    `<span class="mobile-day-full">${MONTHS[activeDay.getMonth()]} ${activeDay.getDate()}, ${activeDay.getFullYear()}</span>` +
    (isActiveTodayDay ? `<span class="mobile-today-chip">Today</span>` : '');
  board.appendChild(heading);

  // ── Span tasks for active day ─────────────────────────────────────────────
  const spanTasksForDay = [];
  const singleTasksForDay = [];

  tasks.forEach(t => {
    const keys = taskDisplayKeys(t);
    if (keys[0] === 'no-date') return;
    if (!keys.includes(activeDayKey)) return;
    if (keys.length > 1) {
      spanTasksForDay.push(t);
    } else {
      singleTasksForDay.push(t);
    }
  });

  // No-date tasks shown separately
  const noDateTasks = tasks.filter(t => taskDisplayKeys(t)[0] === 'no-date');

  // ── Span section ─────────────────────────────────────────────────────────
  if (spanTasksForDay.length > 0) {
    const spanSection = document.createElement('div');
    spanSection.className = 'mobile-section';
    const spanLabel = document.createElement('div');
    spanLabel.className = 'mobile-section-label';
    spanLabel.textContent = 'Multi-day';
    spanSection.appendChild(spanLabel);
    spanTasksForDay.forEach(t => {
      spanSection.appendChild(buildMobileSpanCard(t));
    });
    board.appendChild(spanSection);
  }

  // ── Tasks section ─────────────────────────────────────────────────────────
  const taskSection = document.createElement('div');
  taskSection.className = 'mobile-section mobile-tasks-section';
  taskSection.dataset.colKey = activeDayKey;

  // Task list first
  const taskList = document.createElement('div');
  taskList.className = 'mobile-task-list';

  if (singleTasksForDay.length === 0 && spanTasksForDay.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mobile-empty-state';
    empty.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>No tasks for this day</p>`;
    taskList.appendChild(empty);
  } else {
    singleTasksForDay
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(t => taskList.appendChild(buildMobileTaskCard(t)));
  }

  taskSection.appendChild(taskList);

  // Add button below the task list
  const addArea = document.createElement('div');
  addArea.className = 'mobile-add-area';
  const addBtn = document.createElement('button');
  addBtn.className = 'mobile-add-btn';
  addBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add task</span>`;
  addArea.appendChild(addBtn);
  taskSection.appendChild(addArea);

  board.appendChild(taskSection);

  addBtn.addEventListener('click', () => showMobileInlineAdd(taskList, addArea, activeDayKey, addBtn));

  // ── No-date section ───────────────────────────────────────────────────────
  if (noDateTasks.length > 0) {
    const ndSection = document.createElement('div');
    ndSection.className = 'mobile-section mobile-nodate-section';
    ndSection.dataset.colKey = 'no-date';

    const ndLabel = document.createElement('div');
    ndLabel.className = 'mobile-section-label';
    ndLabel.textContent = 'No date';
    ndSection.appendChild(ndLabel);

    const ndList = document.createElement('div');
    ndList.className = 'mobile-task-list';
    noDateTasks
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(t => ndList.appendChild(buildMobileTaskCard(t)));
    ndSection.appendChild(ndList);

    const ndAddArea = document.createElement('div');
    ndAddArea.className = 'mobile-add-area mobile-add-area--small';
    const ndAddBtn = document.createElement('button');
    ndAddBtn.className = 'mobile-add-btn mobile-add-btn--small';
    ndAddBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add</span>`;
    ndAddArea.appendChild(ndAddBtn);
    ndSection.appendChild(ndAddArea);

    board.appendChild(ndSection);

    ndAddBtn.addEventListener('click', () => showMobileInlineAdd(ndList, ndAddArea, 'no-date', ndAddBtn));
  }

  // ── Swipe gesture ─────────────────────────────────────────────────────────
  attachMobileSwipe(board);
}

// ── Swipe handler ─────────────────────────────────────────────────────────────
let _swipeTouchStartX = 0;
let _swipeTouchStartY = 0;
let _swipeActive = false;

function attachMobileSwipe(el) {
  el.addEventListener('touchstart', e => {
    _swipeTouchStartX = e.touches[0].clientX;
    _swipeTouchStartY = e.touches[0].clientY;
    _swipeActive = false;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - _swipeTouchStartX;
    const dy = e.touches[0].clientY - _swipeTouchStartY;
    if (!_swipeActive && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      _swipeActive = true;
    }
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!_swipeActive) return;
    const dx = e.changedTouches[0].clientX - _swipeTouchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) { mobileDayOffset++; }
      else        { mobileDayOffset--; }
      renderMobileBoard(currentTasks);
    }
    _swipeActive = false;
  }, { passive: true });
}

// ── Mobile card builders ──────────────────────────────────────────────────────

function buildMobileTaskCard(task) {
  const card = document.createElement('div');
  const priority = task.priority || 'medium';
  card.className = `mobile-task-card priority-${priority}` + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const subtasksDone  = (task.subtasks || []).filter(s => s.completed).length;
  const subtasksTotal = (task.subtasks || []).length;
  const progressHtml  = subtasksTotal > 0
    ? `<span class="subtask-progress${subtasksDone === subtasksTotal ? ' done' : ''}">${subtasksDone}/${subtasksTotal}</span>`
    : '';
  const tagsHtml = (task.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');
  let dueDateHtml = '';
  if (task.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    dueDateHtml = `<span class="due-date-badge">📅 ${MONTHS[d.getMonth()]} ${d.getDate()}</span>`;
  }
  const notesIcon = task.notes && task.notes.trim()
    ? `<span class="notes-icon" aria-label="Has notes">📝</span>` : '';

  card.innerHTML = `
    <div class="mobile-card-left">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
    </div>
    <div class="mobile-card-body">
      <div class="mobile-card-title-row">
        <span class="task-title">${escHtml(task.title)}</span>
        ${notesIcon}
      </div>
      <div class="mobile-card-meta">
        <span class="priority-badge ${priority}">${priority}</span>
        ${tagsHtml}${dueDateHtml}${progressHtml}
      </div>
    </div>
    <div class="mobile-card-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));
  return card;
}

function buildMobileSpanCard(task) {
  const card = document.createElement('div');
  const priority = task.priority || 'medium';
  card.className = `mobile-task-card mobile-span-card priority-${priority}` + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const keys = taskDisplayKeys(task);
  const spanDays = keys.length;

  card.innerHTML = `
    <div class="mobile-card-left">
      <button class="task-check${task.completed ? ' checked' : ''}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-check></button>
    </div>
    <div class="mobile-card-body">
      <div class="mobile-card-title-row">
        <span class="task-title">${escHtml(task.title)}</span>
        <span class="span-days-badge">${spanDays}d</span>
      </div>
      <div class="mobile-card-meta">
        <span class="priority-badge ${priority}">${priority}</span>
      </div>
    </div>
    <div class="mobile-card-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;

  card.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleComplete(task.id, !task.completed);
  });
  card.addEventListener('click', () => openModal(task));
  return card;
}

// ── Mobile inline add ─────────────────────────────────────────────────────────

function showMobileInlineAdd(taskList, addArea, colKey, addBtn) {
  addBtn.style.display = 'none';
  const form = document.createElement('div');
  form.className = 'mobile-inline-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'mobile-inline-add-input';
  input.placeholder = 'Task title…';
  input.style.fontSize = '16px';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'mobile-inline-confirm-btn';
  confirmBtn.textContent = 'Add';
  form.appendChild(input);
  form.appendChild(confirmBtn);
  addArea.insertBefore(form, addBtn);

  requestAnimationFrame(() => input.focus());

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

// ══════════════════════════════════════════════════════════════════════════════
// DESKTOP BOARD
// ══════════════════════════════════════════════════════════════════════════════

function renderDesktopBoard(tasks) {
  board.className = 'board';
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

  // ── 1. Header row (day names + dates) ──
  const headerRow = document.createElement('div');
  headerRow.className = 'board-header-row';

  const noDateHdr = document.createElement('div');
  noDateHdr.className = 'column-header no-date-header';
  noDateHdr.dataset.col = 'no-date';
  noDateHdr.innerHTML = `<div class="col-day">No Date</div><div class="col-date">—</div>`;
  headerRow.appendChild(noDateHdr);

  days.forEach(day => {
    const key = toDateKey(day);
    const isToday   = key === todayKey;
    const dayIdx    = day.getDay();
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

  // ── 2. Add-task buttons row (immediately below headers) ──
  const addRow = document.createElement('div');
  addRow.className = 'board-add-row';

  // Store add areas keyed by column so we can wire them up after bodyRow is built
  const addAreas = {};

  allKeys.forEach((key, colIndex) => {
    let isWeekend = false;
    let isToday = false;
    let dayName = 'no-date';

    if (key !== 'no-date') {
      const day = days[colIndex - 1];
      const dayIdx = day.getDay();
      isWeekend = dayIdx === 0 || dayIdx === 6;
      isToday   = key === todayKey;
      dayName   = DAYS[dayIdx].toLowerCase();
    }

    const cell = document.createElement('div');
    cell.className = 'board-add-cell' +
      (key === 'no-date' ? ' no-date' : '') +
      (isWeekend ? ' is-weekend' : '') +
      (isToday   ? ' is-today'   : '');
    cell.dataset.col = dayName;

    const addArea = document.createElement('div');
    addArea.className = 'column-add';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-btn';
    addBtn.textContent = '+ Add task';
    addArea.appendChild(addBtn);
    cell.appendChild(addArea);
    addRow.appendChild(cell);

    addAreas[key] = { addArea, addBtn };
  });

  board.appendChild(addRow);

  // ── 3. Span row (multi-day tasks, below add buttons) ──
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

  // ── 4. Body row (task lists per column) ──
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

    const body = document.createElement('div');
    body.className = 'column-body';
    col.appendChild(body);

    (singleTasks[key] || []).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(task => {
      body.appendChild(buildTaskCard(task));
    });

    bodyRow.appendChild(col);
  });
  board.appendChild(bodyRow);

  // ── Wire up add buttons to their column bodies ──
  allKeys.forEach(key => {
    const { addArea, addBtn } = addAreas[key];
    // Find the matching column-body-wrap
    const col = bodyRow.querySelector(`[data-col-key="${key}"]`);
    addBtn.addEventListener('click', () => showInlineAdd(col, addArea, key, addBtn));
  });

  bindDragAndDrop();
}

// ── Desktop card builders ─────────────────────────────────────────────────────

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

// ── Desktop inline add ────────────────────────────────────────────────────────

function showInlineAdd(col, addArea, colKey, addBtn) {
  addBtn.style.display = 'none';
  const form = document.createElement('div');
  form.className = 'inline-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-add-input';
  input.placeholder = 'Task title...';
  input.style.fontSize = '16px';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'inline-confirm-btn';
  confirmBtn.textContent = '↵';
  form.appendChild(input);
  form.appendChild(confirmBtn);
  addArea.insertBefore(form, addBtn);

  requestAnimationFrame(() => input.focus());

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

// ── Drag & Drop (desktop only) ────────────────────────────────────────────────

let dragId = null;

let touchDragId   = null;
let touchClone    = null;
let touchStartX   = 0;
let touchStartY   = 0;
let touchDragging = false;
const TOUCH_DRAG_THRESHOLD = 12;

let _scrollTop = 0;
function lockBodyScroll() {
  _scrollTop = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.top = `-${_scrollTop}px`;
}
function unlockBodyScroll() {
  document.body.style.overflow = '';
  document.body.style.top = '';
  window.scrollTo(0, _scrollTop);
}

function bindDragAndDrop() {
  board.querySelectorAll('.task-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      dragId = null;
      card.classList.remove('dragging');
      board.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // Touch drag
    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    card.addEventListener('touchend',   handleTouchEnd,   { passive: true });
  });

  board.querySelectorAll('.column-body').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (!dragId) return;
      const colKey = col.closest('.column-body-wrap').dataset.colKey;
      const task   = currentTasks.find(t => t.id === dragId);
      if (!task) return;
      let doOnFrom = null, doOnTo = null;
      if (colKey !== 'no-date') {
        const d = dateKeyToDate(colKey);
        doOnFrom = Timestamp.fromDate(d);
        doOnTo   = Timestamp.fromDate(d);
      }
      const colTasks = currentTasks.filter(t =>
        taskDisplayKeys(t).includes(colKey) && t.id !== dragId
      );
      const minOrder = Math.min(0, ...colTasks.map(t => t.order || 0));
      await reorderTask(dragId, { doOnFrom, doOnTo, order: minOrder - 1000 });
    });
  });
}

function handleTouchStart(e) {
  if (e.touches.length !== 1) return;
  touchDragId   = this.dataset.taskId;
  touchStartX   = e.touches[0].clientX;
  touchStartY   = e.touches[0].clientY;
  touchDragging = false;
  touchClone    = null;
}

function handleTouchMove(e) {
  if (!touchDragId) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (!touchDragging) {
    const isMoreHoriz = Math.abs(dx) > Math.abs(dy);
    if (dist < TOUCH_DRAG_THRESHOLD || !isMoreHoriz) return;
    touchDragging = true;
    lockBodyScroll();
    const orig = this;
    touchClone = orig.cloneNode(true);
    const rect = orig.getBoundingClientRect();
    touchClone.style.cssText = `
      position:fixed;z-index:9999;pointer-events:none;
      width:${rect.width}px;opacity:.9;
      box-shadow:0 8px 32px oklch(.2 .01 80/.25);
      transform:rotate(2deg) scale(1.03);
      transition:none;
      left:${rect.left}px;top:${rect.top}px;
    `;
    document.body.appendChild(touchClone);
    orig.classList.add('touch-dragging');
  }
  if (touchDragging && touchClone) {
    e.preventDefault();
    touchClone.style.left = `${e.touches[0].clientX - touchClone.offsetWidth / 2}px`;
    touchClone.style.top  = `${e.touches[0].clientY - touchClone.offsetHeight / 2}px`;
    const cols = board.querySelectorAll('.column-body');
    cols.forEach(c => c.classList.remove('drag-over'));
    const elBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const overCol = elBelow && elBelow.closest('.column-body');
    if (overCol) overCol.classList.add('drag-over');
  }
}

async function handleTouchEnd(e) {
  if (!touchDragId) return;
  unlockBodyScroll();
  if (touchClone) { touchClone.remove(); touchClone = null; }
  board.querySelectorAll('.touch-dragging').forEach(c => c.classList.remove('touch-dragging'));
  board.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));

  if (touchDragging && e.changedTouches.length === 1) {
    const elBelow = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const overCol = elBelow && elBelow.closest('.column-body-wrap');
    if (overCol) {
      const colKey = overCol.dataset.colKey;
      let doOnFrom = null, doOnTo = null;
      if (colKey !== 'no-date') {
        const d = dateKeyToDate(colKey);
        doOnFrom = Timestamp.fromDate(d);
        doOnTo   = Timestamp.fromDate(d);
      }
      const colTasks = currentTasks.filter(t =>
        taskDisplayKeys(t).includes(colKey) && t.id !== touchDragId
      );
      const minOrder = Math.min(0, ...colTasks.map(t => t.order || 0));
      await reorderTask(touchDragId, { doOnFrom, doOnTo, order: minOrder - 1000 });
    }
  }
  touchDragId   = null;
  touchDragging = false;
}

// ── Shared utils ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Week nav (desktop topbar controls) ───────────────────────────────────────
export function prevWeek()  { weekOffset--;  renderBoard(currentTasks); }
export function nextWeek()  { weekOffset++;  renderBoard(currentTasks); }
export function gotoToday() { weekOffset = 0; mobileDayOffset = 0; renderBoard(currentTasks); }

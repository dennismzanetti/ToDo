import { toDateKey, dateKeyToDate, taskDisplayKeys } from './models.js';
import { addTask, toggleComplete, reorderTask } from './store.js';
import { openModal } from './modal.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let weekOffset = 0;
let currentTasks = [];
let mobileDayOffset = 0;

const board     = document.getElementById('board');
const weekLabel = document.getElementById('week-label');

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ICONS = {
  chevronRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`,
  calendar: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  note: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
};

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
  const center = new Date();
  center.setHours(0, 0, 0, 0);
  center.setDate(center.getDate() + mobileDayOffset);
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

  const strip = document.createElement('div');
  strip.className = 'mobile-day-strip';

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

  const heading = document.createElement('div');
  heading.className = 'mobile-day-heading';
  const isActiveTodayDay = activeDayKey === todayKey;
  heading.innerHTML =
    `<span class="mobile-day-name${isActiveTodayDay ? ' is-today' : ''}">${DAYS[activeDay.getDay()]}</span>` +
    `<span class="mobile-day-full">${MONTHS[activeDay.getMonth()]} ${activeDay.getDate()}, ${activeDay.getFullYear()}</span>` +
    (isActiveTodayDay ? `<span class="mobile-today-chip">Today</span>` : '');
  board.appendChild(heading);

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

  const noDateTasks = tasks.filter(t => taskDisplayKeys(t)[0] === 'no-date');

  if (spanTasksForDay.length > 0) {
    const spanSection = document.createElement('div');
    spanSection.className = 'mobile-section';
    const spanLabel = document.createElement('div');
    spanLabel.className = 'mobile-section-label';
    spanLabel.textContent = 'Multi-day';
    spanSection.appendChild(spanLabel);
    spanTasksForDay.forEach(t => spanSection.appendChild(buildMobileSpanCard(t)));
    board.appendChild(spanSection);
  }

  const taskSection = document.createElement('div');
  taskSection.className = 'mobile-section mobile-tasks-section';
  taskSection.dataset.colKey = activeDayKey;

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

  const addArea = document.createElement('div');
  addArea.className = 'mobile-add-area';
  const addBtn = document.createElement('button');
  addBtn.className = 'mobile-add-btn';
  addBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add task</span>`;
  addArea.appendChild(addBtn);
  taskSection.appendChild(addArea);
  board.appendChild(taskSection);

  addBtn.addEventListener('click', () => showMobileInlineAdd(taskList, addArea, activeDayKey, addBtn));

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

// ── Mobile card builders ─────────────────────────────────────────────────────

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
    dueDateHtml = `<span class="due-date-badge"><span class="mobile-meta-icon">${ICONS.calendar}</span><span>${MONTHS[d.getMonth()]} ${d.getDate()}</span></span>`;
  }
  const notesIcon = task.notes && task.notes.trim()
    ? `<span class="mobile-notes-icon" aria-label="Has notes">${ICONS.note}</span>` : '';

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
    <div class="mobile-card-arrow" aria-hidden="true">
      ${ICONS.chevronRight}
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
  const notesIcon = task.notes && task.notes.trim()
    ? `<span class="mobile-notes-icon" aria-label="Has notes">${ICONS.note}</span>` : '';

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
        <span class="span-days-badge">${spanDays}d</span>
      </div>
    </div>
    <div class="mobile-card-arrow" aria-hidden="true">
      ${ICONS.chevronRight}
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

  const addRow = document.createElement('div');
  addRow.className = 'board-add-row';
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

  const spanRow = document.createElement('div');
  spanRow.className = 'board-span-row';

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
    const bg = document.createElement('div');
    bg.className = 'span-row-bg-cell' +
      (key === 'no-date' ? ' no-date'    : '') +
      (isWeekend         ? ' is-weekend' : '') +
      (isToday           ? ' is-today'   : '');
    bg.dataset.col = dayName;
    bg.style.gridColumn = `${colIndex + 1} / ${colIndex + 2}`;
    spanRow.appendChild(bg);
  });

  spanTasks.forEach(({ task, visibleKeys }) => {
    const startIdx = allKeys.indexOf(visibleKeys[0]);
    const endIdx   = allKeys.indexOf(visibleKeys[visibleKeys.length - 1]);
    const card = buildSpanCard(task, visibleKeys.length);
    card.style.gridColumn = `${startIdx + 1} / ${endIdx + 2}`;
    card.style.zIndex = '1';
    spanRow.appendChild(card);
  });
  board.appendChild(spanRow);

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

  allKeys.forEach(key => {
    const { addArea, addBtn } = addAreas[key];
    const col = bodyRow.querySelector(`[data-col-key="${key}"]`);
    addBtn.addEventListener('click', () => showInlineAdd(col, addArea, key, addBtn));
  });

  bindDragAndDrop(bodyRow);
}

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

let dragId = null;
let dragOverWrap = null;

function bindDragAndDrop(bodyRow) {
  bodyRow.querySelectorAll('.task-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    card.addEventListener('dragend', () => {
      dragId = null;
      card.classList.remove('dragging');
      clearDragOver();
    });
  });

  bodyRow.querySelectorAll('.column-body-wrap').forEach(wrap => {
    wrap.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverWrap !== wrap) {
        clearDragOver();
        dragOverWrap = wrap;
        wrap.classList.add('drag-over');
      }
    });

    let enterCount = 0;
    wrap.addEventListener('dragenter', e => {
      if (!dragId) return;
      e.preventDefault();
      enterCount++;
      wrap.classList.add('drag-over');
    });
    wrap.addEventListener('dragleave', () => {
      enterCount--;
      if (enterCount <= 0) {
        enterCount = 0;
        wrap.classList.remove('drag-over');
        if (dragOverWrap === wrap) dragOverWrap = null;
      }
    });

    wrap.addEventListener('drop', async e => {
      e.preventDefault();
      enterCount = 0;
      wrap.classList.remove('drag-over');
      dragOverWrap = null;
      if (!dragId) return;

      const colKey = wrap.dataset.colKey;
      const task   = currentTasks.find(t => t.id === dragId);
      if (!task) return;

      const currentKeys = taskDisplayKeys(task);
      if (currentKeys.length === 1 && currentKeys[0] === colKey) return;

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

function clearDragOver() {
  board.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragOverWrap = null;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function prevWeek()  { weekOffset--;  renderBoard(currentTasks); }
export function nextWeek()  { weekOffset++;  renderBoard(currentTasks); }
export function gotoToday() { weekOffset = 0; mobileDayOffset = 0; renderBoard(currentTasks); }

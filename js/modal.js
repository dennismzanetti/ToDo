import { saveTask, deleteTask, addTask, subscribeCategories } from './store.js';
import { createSubtask } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const overlay         = document.getElementById('modal-overlay');
const form            = document.getElementById('task-form');
const titleInput      = document.getElementById('edit-title');
const priorityInput   = document.getElementById('edit-priority');
const dueDateInput    = document.getElementById('edit-due-date');
const clearDueDateBtn = document.getElementById('clear-due-date');
const tagsInput       = document.getElementById('edit-tags');
const assignedToInput = document.getElementById('edit-assigned-to');
const subtaskList     = document.getElementById('subtask-list');
const newSubtaskInput = document.getElementById('new-subtask-input');
const addSubtaskBtn   = document.getElementById('add-subtask-btn');
const deleteBtn       = document.getElementById('delete-task-btn');
const cancelBtn       = document.getElementById('modal-cancel');
const closeBtn        = document.getElementById('modal-close');
const doOnTodayBtn    = document.getElementById('do-on-today');

// ── Do On date proxy elements ─────────────────────────────────────────────────
// Each Do On field has:
//   display  — type="text" readonly, shows formatted date to the user
//   proxy    — type="date" hidden off-screen, triggers native picker on tap
//   clearBtn — ✕ button to clear the field
//
// WHY: iOS Safari auto-populates visible type="date" inputs with today's date
// the moment the form becomes visible — this cannot be stopped with JS.
// A hidden type="date" input is never auto-populated because Safari only fills
// visible inputs. We layer the visible text display on top and sync values.
const fromDisplay  = document.getElementById('edit-do-on-from-display');
const fromProxy    = document.getElementById('edit-do-on-from');
const fromClearBtn = document.getElementById('clear-do-on-from');
const toDisplay    = document.getElementById('edit-do-on-to-display');
const toProxy      = document.getElementById('edit-do-on-to');
const toClearBtn   = document.getElementById('clear-do-on-to');

// Format YYYY-MM-DD → MM/DD/YYYY for display
function fmtDisplay(val) {
  if (!val) return '';
  const [y, m, d] = val.split('-');
  return `${m}/${d}/${y}`;
}

function syncFromDisplay() {
  fromDisplay.value = fmtDisplay(fromProxy.value);
  fromClearBtn.style.display = fromProxy.value ? 'inline-flex' : 'none';
}
function syncToDisplay() {
  toDisplay.value = fmtDisplay(toProxy.value);
  toClearBtn.style.display = toProxy.value ? 'inline-flex' : 'none';
}

// Tapping the text display opens the hidden proxy picker
fromDisplay.addEventListener('click', () => fromProxy.showPicker?.() ?? fromProxy.click());
toDisplay.addEventListener('click',   () => toProxy.showPicker?.()   ?? toProxy.click());

fromProxy.addEventListener('change', () => {
  enforceSpanOrder();
  syncFromDisplay();
  syncToDisplay();
});
toProxy.addEventListener('change', () => {
  enforceSpanOrder();
  syncToDisplay();
});

fromClearBtn.addEventListener('click', () => {
  fromProxy.value = '';
  toProxy.value   = '';
  syncFromDisplay();
  syncToDisplay();
});
toClearBtn.addEventListener('click', () => {
  toProxy.value = '';
  syncToDisplay();
});

// ── Live categories cache ─────────────────────────────────────────────────────
let _categories = [];
subscribeCategories(cats => {
  _categories = cats.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (overlay && !overlay.hidden) {
    const sel = document.getElementById('edit-category');
    populateCategorySelect(sel?.value || '');
  }
});

// ── Priority segmented buttons ────────────────────────────────────────────────
const priorityBtns = document.querySelectorAll('.priority-btn[data-priority]');

function setPriority(val) {
  priorityInput.value = val;
  priorityBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === val);
  });
}

priorityBtns.forEach(btn => {
  btn.addEventListener('click', () => setPriority(btn.dataset.priority));
});

// ── Category select ───────────────────────────────────────────────────────────
function populateCategorySelect(currentCategoryId) {
  const sel = document.getElementById('edit-category');
  if (!sel) return;
  sel.innerHTML = '<option value="">None</option>' +
    _categories
      .map(c => `<option value="${escHtml(c.id)}"${c.id === currentCategoryId ? ' selected' : ''}>${escHtml(c.name)}</option>`)
      .join('');
}

// ── Body scroll lock ──────────────────────────────────────────────────────────
let _bodyScrollTop = 0;
function lockBodyScroll() {
  _bodyScrollTop = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top      = `-${_bodyScrollTop}px`;
  document.body.style.width    = '100%';
}
function unlockBodyScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.width    = '';
  window.scrollTo(0, _bodyScrollTop);
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function showDeleteConfirm() {
  if (deleteBtn.parentElement.querySelector('.delete-confirm-row')) return;

  const row = document.createElement('div');
  row.className = 'delete-confirm-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;animation:fadeIn .15s ease';
  row.innerHTML = `
    <span style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:nowrap">Delete this task?</span>
    <button type="button" class="btn btn-danger" id="confirm-delete-yes" style="padding:.35rem .8rem;min-height:36px">Yes, delete</button>
    <button type="button" class="btn btn-ghost" id="confirm-delete-no" style="padding:.35rem .8rem;min-height:36px">Cancel</button>
  `;
  deleteBtn.parentElement.appendChild(row);
  deleteBtn.style.display = 'none';

  row.querySelector('#confirm-delete-yes').addEventListener('click', async () => {
    if (!currentTask?.id) return;
    await deleteTask(currentTask.id);
    closeModal();
  });
  row.querySelector('#confirm-delete-no').addEventListener('click', () => {
    row.remove();
    deleteBtn.style.display = '';
  });
}

// ── Clear due date button ─────────────────────────────────────────────────────
clearDueDateBtn.addEventListener('click', () => {
  dueDateInput.value = '';
  syncClearBtn();
});

function syncClearBtn() {
  clearDueDateBtn.style.display = dueDateInput.value ? 'inline-flex' : 'none';
}

dueDateInput.addEventListener('change', syncClearBtn);

// ── Today button — sets Do On From/To to today ────────────────────────────────
doOnTodayBtn.addEventListener('click', () => {
  const today = new Date();
  const val = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  fromProxy.value = val;
  toProxy.value   = val;
  syncFromDisplay();
  syncToDisplay();
});

let notesInput = null;
document.addEventListener('DOMContentLoaded', () => {
  notesInput = document.getElementById('edit-notes');
});
if (!notesInput) notesInput = document.getElementById('edit-notes');

let currentTask     = null;
let pendingSubtasks = [];

function tsToInputVal(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function inputToTs(val) {
  if (!val) return null;
  const [y,m,d] = val.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m-1, d));
}

function setDoOnProxies(fromVal, toVal) {
  fromProxy.value = fromVal || '';
  toProxy.value   = toVal   || '';
  enforceSpanOrder();
  syncFromDisplay();
  syncToDisplay();
}

export function openModal(task) {
  const t = task || {};
  currentTask     = task;
  pendingSubtasks = JSON.parse(JSON.stringify(t.subtasks || []));

  titleInput.value      = t.title || '';
  tagsInput.value       = (t.tags || []).join(', ');
  dueDateInput.value    = tsToInputVal(t.dueDate);
  if (assignedToInput) assignedToInput.value = t.assignedTo || '';

  // Set Do On proxies — hidden inputs are never auto-populated by Safari
  setDoOnProxies(
    task ? tsToInputVal(t.doOnFrom) : '',
    task ? tsToInputVal(t.doOnTo || t.doOnFrom) : ''
  );

  setPriority(t.priority || 'medium');
  populateCategorySelect(t.categoryId || '');
  syncClearBtn();

  notesInput = document.getElementById('edit-notes');
  if (notesInput) notesInput.value = t.notes || '';

  const confirmRow = overlay.querySelector('.delete-confirm-row');
  if (confirmRow) confirmRow.remove();

  const modalTitle = document.getElementById('modal-title');
  if (modalTitle) modalTitle.textContent = task ? 'Edit Task' : 'New Task';
  deleteBtn.style.display = task ? '' : 'none';

  renderSubtasks();
  overlay.hidden = false;
  lockBodyScroll();

  requestAnimationFrame(() => {
    if (window.matchMedia('(hover: hover)').matches) titleInput.focus();
  });
}

// Exported so board.js can pre-fill dates after calling openModal(null)
export function setDoOnDates(fromVal, toVal) {
  setDoOnProxies(fromVal, toVal);
}

function enforceSpanOrder() {
  if (fromProxy.value && toProxy.value && toProxy.value < fromProxy.value) {
    toProxy.value = fromProxy.value;
  }
  toProxy.min = fromProxy.value || '';
}

function renderSubtasks() {
  subtaskList.innerHTML = '';
  pendingSubtasks.forEach((st, i) => {
    const item = document.createElement('div');
    item.className = 'subtask-item';
    item.innerHTML = `
      <input type="checkbox" ${st.completed ? 'checked' : ''} aria-label="Subtask done" />
      <span class="${st.completed ? 'done' : ''}">${escHtml(st.title)}</span>
      <button type="button" class="subtask-remove" aria-label="Remove subtask">&times;</button>`;
    item.querySelector('input').addEventListener('change', e => {
      pendingSubtasks[i].completed = e.target.checked;
      item.querySelector('span').className = e.target.checked ? 'done' : '';
    });
    item.querySelector('.subtask-remove').addEventListener('click', () => {
      pendingSubtasks.splice(i, 1);
      renderSubtasks();
    });
    subtaskList.appendChild(item);
  });
}

addSubtaskBtn.addEventListener('click', () => {
  const t = newSubtaskInput.value.trim();
  if (!t) return;
  pendingSubtasks.push(createSubtask(t));
  newSubtaskInput.value = '';
  renderSubtasks();
  requestAnimationFrame(() => newSubtaskInput.focus());
});

newSubtaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtaskBtn.click(); }
});

function closeModal() {
  overlay.hidden = true;
  unlockBodyScroll();
  currentTask     = null;
  pendingSubtasks = [];
  form.reset();
  // Reset Do On proxies and displays
  setDoOnProxies('', '');
  subtaskList.innerHTML = '';
  syncClearBtn();
  setPriority('medium');
}

cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

deleteBtn.addEventListener('click', () => showDeleteConfirm());

form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }

  const doOnFrom = inputToTs(fromProxy.value);
  const doOnTo   = inputToTs(toProxy.value) || doOnFrom;

  const notesEl = document.getElementById('edit-notes');
  const notes = notesEl ? notesEl.value.trim() : '';

  const categorySel = document.getElementById('edit-category');
  const categoryId  = categorySel?.value || null;

  const fields = {
    title,
    priority:   priorityInput.value,
    categoryId: categoryId || null,
    assignedTo: assignedToInput ? assignedToInput.value.trim() : '',
    doOnFrom,
    doOnTo,
    dueDate:  inputToTs(dueDateInput.value),
    tags:     tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    notes,
    subtasks: pendingSubtasks
  };

  if (currentTask?.id) {
    await saveTask(currentTask.id, fields);
  } else {
    await addTask(fields);
  }
  closeModal();
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

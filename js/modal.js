import { saveTask, deleteTask, addTask, subscribeCategories } from './store.js';
import { createSubtask } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const overlay         = document.getElementById('modal-overlay');
const form            = document.getElementById('task-form');
const titleInput      = document.getElementById('edit-title');
const priorityInput   = document.getElementById('edit-priority');
const doOnFromInput   = document.getElementById('edit-do-on-from');
const doOnToInput     = document.getElementById('edit-do-on-to');
const dueDateInput    = document.getElementById('edit-due-date');
const clearDueDateBtn = document.getElementById('clear-due-date');
const tagsInput       = document.getElementById('edit-tags');
const subtaskList     = document.getElementById('subtask-list');
const newSubtaskInput = document.getElementById('new-subtask-input');
const addSubtaskBtn   = document.getElementById('add-subtask-btn');
const deleteBtn       = document.getElementById('delete-task-btn');
const cancelBtn       = document.getElementById('modal-cancel');
const closeBtn        = document.getElementById('modal-close');
const doOnTodayBtn    = document.getElementById('do-on-today');

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

// ── Body scroll lock ─────────────────────────────────────────────────────────
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

// ── Clear due date button ────────────────────────────────────────────────────
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
  doOnFromInput.value = val;
  doOnToInput.value   = val;
  enforceSpanOrder();
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

export function openModal(task) {
  const t = task || {};
  currentTask     = task;
  pendingSubtasks = JSON.parse(JSON.stringify(t.subtasks || []));

  titleInput.value   = t.title || '';
  tagsInput.value    = (t.tags || []).join(', ');
  dueDateInput.value = tsToInputVal(t.dueDate);

  // Do On dates: always explicitly set — never rely on form.reset() or browser defaults
  doOnFromInput.value = task ? tsToInputVal(t.doOnFrom) : '';
  doOnToInput.value   = task ? tsToInputVal(t.doOnTo || t.doOnFrom) : '';
  // Belt-and-suspenders: forcibly remove any cached value attribute the browser may restore
  doOnFromInput.removeAttribute('value');
  doOnToInput.removeAttribute('value');
  doOnToInput.min = doOnFromInput.value || '';

  setPriority(t.priority || 'medium');
  populateCategorySelect(t.categoryId || '');
  syncClearBtn();

  notesInput = document.getElementById('edit-notes');
  if (notesInput) notesInput.value = t.notes || '';

  doOnFromInput.addEventListener('change', enforceSpanOrder, { once: false });

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
  doOnFromInput.value = fromVal || '';
  doOnToInput.value   = toVal   || '';
  enforceSpanOrder();
}

function enforceSpanOrder() {
  if (doOnFromInput.value && doOnToInput.value && doOnToInput.value < doOnFromInput.value) {
    doOnToInput.value = doOnFromInput.value;
  }
  doOnToInput.min = doOnFromInput.value || '';
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
  // Explicitly clear date fields after reset — form.reset() can restore browser-cached values
  doOnFromInput.value = '';
  doOnToInput.value   = '';
  doOnFromInput.removeAttribute('value');
  doOnToInput.removeAttribute('value');
  subtaskList.innerHTML = '';
  doOnToInput.min = '';
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

  const doOnFrom = inputToTs(doOnFromInput.value);
  const doOnTo   = inputToTs(doOnToInput.value) || doOnFrom;

  const notesEl = document.getElementById('edit-notes');
  const notes = notesEl ? notesEl.value.trim() : '';

  const categorySel = document.getElementById('edit-category');
  const categoryId  = categorySel?.value || null;

  const fields = {
    title,
    priority:   priorityInput.value,
    categoryId: categoryId || null,
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

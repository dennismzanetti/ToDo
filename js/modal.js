import { saveTask, deleteTask, addTask } from './store.js';
import { createSubtask } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const overlay       = document.getElementById('modal-overlay');
const form          = document.getElementById('task-form');
const titleInput    = document.getElementById('edit-title');
const priorityInput = document.getElementById('edit-priority');
const doOnFromInput = document.getElementById('edit-do-on-from');
const doOnToInput   = document.getElementById('edit-do-on-to');
const dueDateInput  = document.getElementById('edit-due-date');
const tagsInput     = document.getElementById('edit-tags');
const subtaskList   = document.getElementById('subtask-list');
const newSubtaskInput = document.getElementById('new-subtask-input');
const addSubtaskBtn   = document.getElementById('add-subtask-btn');
const deleteBtn     = document.getElementById('delete-task-btn');
const cancelBtn     = document.getElementById('modal-cancel');
const closeBtn      = document.getElementById('modal-close');

// Resolved after DOM is ready
let notesInput = null;
document.addEventListener('DOMContentLoaded', () => {
  notesInput = document.getElementById('edit-notes');
  console.log('[modal] notesInput bound:', notesInput);
});
// Fallback: also try immediately (works if script runs after DOM parse)
if (!notesInput) {
  notesInput = document.getElementById('edit-notes');
}

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
  currentTask     = task;
  pendingSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));

  titleInput.value    = task.title    || '';
  priorityInput.value = task.priority || 'medium';
  doOnFromInput.value = tsToInputVal(task.doOnFrom);
  doOnToInput.value   = tsToInputVal(task.doOnTo || task.doOnFrom);
  dueDateInput.value  = tsToInputVal(task.dueDate);
  tagsInput.value     = (task.tags || []).join(', ');

  // Always re-query in case reference is stale
  notesInput = document.getElementById('edit-notes');
  console.log('[modal] openModal notesInput:', notesInput, 'task.notes:', task.notes);
  if (notesInput) notesInput.value = task.notes || '';

  doOnFromInput.addEventListener('change', enforceSpanOrder, { once: false });

  renderSubtasks();
  overlay.hidden = false;
  titleInput.focus();
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
  newSubtaskInput.focus();
});

newSubtaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtaskBtn.click(); }
});

function closeModal() {
  overlay.hidden = true;
  currentTask     = null;
  pendingSubtasks = [];
  form.reset();
  subtaskList.innerHTML = '';
  doOnToInput.min = '';
}

cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

deleteBtn.addEventListener('click', async () => {
  if (!currentTask?.id) return;
  if (!confirm('Delete this task?')) return;
  await deleteTask(currentTask.id);
  closeModal();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }

  const doOnFrom = inputToTs(doOnFromInput.value);
  const doOnTo   = inputToTs(doOnToInput.value) || doOnFrom;

  // Re-query at submit time as final safety net
  const notesEl = document.getElementById('edit-notes');
  const notes = notesEl ? notesEl.value.trim() : '';
  console.log('[modal] submit — notesEl:', notesEl, 'notes value:', notes);

  const fields = {
    title,
    priority: priorityInput.value,
    doOnFrom,
    doOnTo,
    dueDate:  inputToTs(dueDateInput.value),
    tags:     tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    notes,
    subtasks: pendingSubtasks
  };

  console.log('[modal] saving fields:', fields);

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

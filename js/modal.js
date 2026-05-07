import { saveTask, deleteTask, addTask } from './store.js';
import { createSubtask } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const overlay = document.getElementById('modal-overlay');
const form = document.getElementById('task-form');
const titleInput = document.getElementById('edit-title');
const priorityInput = document.getElementById('edit-priority');
const dueDateInput = document.getElementById('edit-due-date');
const tagsInput = document.getElementById('edit-tags');
const subtaskList = document.getElementById('subtask-list');
const newSubtaskInput = document.getElementById('new-subtask-input');
const addSubtaskBtn = document.getElementById('add-subtask-btn');
const deleteBtn = document.getElementById('delete-task-btn');
const cancelBtn = document.getElementById('modal-cancel');
const closeBtn = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');

let currentTask = null;
let pendingSubtasks = [];

export function openModal(task) {
  currentTask = task;
  pendingSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));

  modalTitle.textContent = 'Edit Task';
  titleInput.value = task.title || '';
  priorityInput.value = task.priority || 'medium';

  if (task.dueDate) {
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    dueDateInput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } else {
    dueDateInput.value = '';
  }

  tagsInput.value = (task.tags || []).join(', ');
  renderSubtasks();
  overlay.hidden = false;
  titleInput.focus();
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
  currentTask = null;
  pendingSubtasks = [];
  form.reset();
  subtaskList.innerHTML = '';
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

  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

  let dueDate = null;
  if (dueDateInput.value) {
    const [y,m,d] = dueDateInput.value.split('-').map(Number);
    dueDate = Timestamp.fromDate(new Date(y, m-1, d));
  }

  const fields = {
    title,
    priority: priorityInput.value,
    dueDate,
    tags,
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

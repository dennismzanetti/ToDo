import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function createTask(fields = {}) {
  return {
    title: fields.title || '',
    priority: fields.priority || 'medium',
    dueDate: fields.dueDate || null,
    completed: fields.completed || false,
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    subtasks: Array.isArray(fields.subtasks) ? fields.subtasks : [],
    order: typeof fields.order === 'number' ? fields.order : Date.now(),
    createdAt: fields.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now()
  };
}

export function createSubtask(title) {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false
  };
}

export function taskDateKey(task) {
  if (!task.dueDate) return 'no-date';
  const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
  return toDateKey(d);
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateKeyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

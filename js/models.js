import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function createTask(fields = {}) {
  return {
    title: fields.title || '',
    priority: fields.priority || 'medium',
    dueDate: fields.dueDate || null,
    completed: fields.completed || false,
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    subtasks: Array.isArray(fields.subtasks) ? fields.subtasks.map(s => ({ ...s, completed: false })) : [],
    order: typeof fields.order === 'number' ? fields.order : Date.now(),
    templateId: fields.templateId || null,
    createdAt: fields.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now()
  };
}

export function createSubtask(title) {
  return { id: crypto.randomUUID(), title, completed: false };
}

export function createTemplate(fields = {}) {
  return {
    title: fields.title || '',
    priority: fields.priority || 'medium',
    recurrence: fields.recurrence || 'daily',
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    subtasks: Array.isArray(fields.subtasks) ? fields.subtasks : [],
    createdAt: fields.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now()
  };
}

// Recurrence options
export const RECURRENCE_LABELS = {
  'daily':     'Daily (Mon–Fri)',
  'daily-all': 'Every day',
  'mon': 'Every Monday',
  'tue': 'Every Tuesday',
  'wed': 'Every Wednesday',
  'thu': 'Every Thursday',
  'fri': 'Every Friday',
  'sat': 'Every Saturday',
  'sun': 'Every Sunday'
};

// JS day index: 0=Sun,1=Mon,...,6=Sat
const DAY_MAP = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

/**
 * Returns true if a template should fire on a given Date.
 */
export function templateMatchesDate(template, date) {
  const dow = date.getDay(); // 0=Sun
  switch (template.recurrence) {
    case 'daily':     return dow >= 1 && dow <= 5; // Mon-Fri
    case 'daily-all': return true;
    default:
      return DAY_MAP[template.recurrence] === dow;
  }
}

export function taskDateKey(task) {
  if (!task.dueDate) return 'no-date';
  const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
  return toDateKey(d);
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function dateKeyToDate(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d);
}

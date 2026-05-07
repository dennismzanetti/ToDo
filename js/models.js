import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function createTask(fields = {}) {
  return {
    title: fields.title || '',
    priority: fields.priority || 'medium',
    // doOnFrom / doOnTo: the date span controlling which board column(s) the task appears in
    doOnFrom: fields.doOnFrom || null,
    doOnTo:   fields.doOnTo   || null,
    // dueDate: deadline shown on the card but NOT used for column placement
    dueDate:  fields.dueDate  || null,
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

const DAY_MAP = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

export function templateMatchesDate(template, date) {
  const dow = date.getDay();
  switch (template.recurrence) {
    case 'daily':     return dow >= 1 && dow <= 5;
    case 'daily-all': return true;
    default: return DAY_MAP[template.recurrence] === dow;
  }
}

/**
 * Returns the date keys a task should appear in on the board.
 * Uses doOnFrom/doOnTo span. Falls back to dueDate for legacy tasks.
 * Returns ['no-date'] if nothing is set.
 */
export function taskDisplayKeys(task) {
  const from = tsToDate(task.doOnFrom);
  const to   = tsToDate(task.doOnTo);

  if (from) {
    const end = to && to >= from ? to : from;
    const keys = [];
    const cur = new Date(from);
    cur.setHours(0,0,0,0);
    const endD = new Date(end);
    endD.setHours(0,0,0,0);
    while (cur <= endD) {
      keys.push(toDateKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  // Legacy fallback: use dueDate
  if (task.dueDate) {
    const d = tsToDate(task.dueDate);
    return d ? [toDateKey(d)] : ['no-date'];
  }

  return ['no-date'];
}

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function dateKeyToDate(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d);
}

/**
 * Templates engine — auto-applies templates to the next 7 days on app load.
 * Skips any day that already has a task from the same template (matched by templateId + dateKey).
 */
import { addTask, getTasks, getTemplates } from './store.js';
import { templateMatchesDate, toDateKey } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function applyTemplates() {
  const tasks = getTasks();
  const templates = getTemplates();
  if (!templates.length) return;

  // Build a Set of "templateId|dateKey" for fast duplicate lookup
  const existing = new Set(
    tasks
      .filter(t => t.templateId)
      .map(t => {
        const dk = t.dueDate
          ? toDateKey(t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate))
          : 'no-date';
        return `${t.templateId}|${dk}`;
      })
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const promises = [];

  for (const tmpl of templates) {
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);

      if (!templateMatchesDate(tmpl, day)) continue;

      const dk = toDateKey(day);
      const key = `${tmpl.id}|${dk}`;
      if (existing.has(key)) continue;

      promises.push(
        addTask({
          title: tmpl.title,
          priority: tmpl.priority,
          dueDate: Timestamp.fromDate(day),
          tags: tmpl.tags || [],
          subtasks: (tmpl.subtasks || []).map(s => ({ ...s, completed: false })),
          order: Date.now() + i,
          templateId: tmpl.id
        })
      );

      // Mark as existing immediately to avoid duplicate adds in same batch
      existing.add(key);
    }
  }

  await Promise.all(promises);
}

/**
 * Templates engine — auto-applies templates to the next 7 days on app load.
 *
 * Duplicate prevention strategy:
 *   - Each template document stores an `appliedDates` array (e.g. ["2026-05-07", "2026-05-08"]).
 *   - Once a date is recorded in appliedDates, the engine NEVER creates a task for that
 *     template+date again — even if the task was moved, deleted, or completed.
 *   - This means moving a templated task to another day will NOT cause a re-creation.
 */
import { addTask, getTemplates, markTemplateApplied } from './store.js';
import { templateMatchesDate, toDateKey } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function applyTemplates() {
  const templates = getTemplates();
  if (!templates.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const tmpl of templates) {
    // appliedDates is the canonical record of what has already been created
    const appliedDates = new Set(tmpl.appliedDates || []);
    const newDates = [];
    const taskPromises = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);

      if (!templateMatchesDate(tmpl, day)) continue;

      const dk = toDateKey(day);
      if (appliedDates.has(dk)) continue; // already created once — skip forever

      taskPromises.push(
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

      newDates.push(dk);
      appliedDates.add(dk); // prevent duplicates within the same run
    }

    if (taskPromises.length) {
      // Create tasks and persist the new applied dates atomically
      await Promise.all([
        ...taskPromises,
        markTemplateApplied(tmpl.id, [...(tmpl.appliedDates || []), ...newDates])
      ]);
    }
  }
}

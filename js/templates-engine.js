import { addTask, getTemplates, markTemplateApplied } from './store.js';
import { templateMatchesDate, toDateKey } from './models.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function applyTemplates() {
  const templates = getTemplates();
  if (!templates.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const tmpl of templates) {
    const appliedDates = new Set(tmpl.appliedDates || []);
    const newDates = [];
    const taskPromises = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);

      if (!templateMatchesDate(tmpl, day)) continue;

      const dk = toDateKey(day);
      if (appliedDates.has(dk)) continue;

      const ts = Timestamp.fromDate(day);
      taskPromises.push(
        addTask({
          title:        tmpl.title,
          priority:     tmpl.priority,
          doOnFrom:     ts,
          doOnTo:       ts,
          dueDate:      null,
          tags:         tmpl.tags || [],
          subtasks:     (tmpl.subtasks || []).map(s => ({ ...s, completed: false })),
          order:        Date.now() + i,
          templateId:   tmpl.id,
          carryForward: tmpl.carryForward || false
        })
      );

      newDates.push(dk);
      appliedDates.add(dk);
    }

    if (taskPromises.length) {
      await Promise.all([
        ...taskPromises,
        markTemplateApplied(tmpl.id, [...(tmpl.appliedDates || []), ...newDates])
      ]);
    }
  }
}

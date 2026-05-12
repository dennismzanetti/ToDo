import {
  addTemplate, saveTemplate, deleteTemplate, subscribeTemplates
} from './store.js';
import { createSubtask, RECURRENCE_LABELS } from './models.js';

const overlay          = document.getElementById('tmpl-modal-overlay');
const form             = document.getElementById('tmpl-form');
const tmplIdInput      = document.getElementById('tmpl-id');
const titleInput       = document.getElementById('tmpl-title');
const notesInput       = document.getElementById('tmpl-notes');
const priorityHidden   = document.getElementById('tmpl-priority');
const recurrenceHidden = document.getElementById('tmpl-recurrence');
const tagsInput        = document.getElementById('tmpl-tags');
const subtaskList      = document.getElementById('tmpl-subtask-list');
const newSubtaskInput  = document.getElementById('tmpl-new-subtask');
const addSubtaskBtn    = document.getElementById('tmpl-add-subtask-btn');
const deleteBtn        = document.getElementById('tmpl-delete-btn');
const cancelBtn        = document.getElementById('tmpl-cancel');
const closeBtn         = document.getElementById('tmpl-modal-close');
const modalTitle       = document.getElementById('tmpl-modal-title');
const templatesList    = document.getElementById('templates-list');
const emptyState       = document.getElementById('templates-empty');
const recurrenceGroup  = document.getElementById('tmpl-recurrence-group');

let pendingSubtasks = [];
let dragSrcIndex = null;

// ── Priority button group ─────────────────────────────────────────────────
document.querySelectorAll('.priority-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    priorityHidden.value = btn.dataset.priority;
  });
});

function setPriority(val) {
  document.querySelectorAll('.priority-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.priority === val);
  });
  priorityHidden.value = val;
}

// ── Recurrence pill group ─────────────────────────────────────────────────
recurrenceGroup.querySelectorAll('.recurrence-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    recurrenceGroup.querySelectorAll('.recurrence-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    recurrenceHidden.value = pill.dataset.value;
  });
});

function setRecurrence(val) {
  recurrenceGroup.querySelectorAll('.recurrence-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.value === val);
  });
  recurrenceHidden.value = val;
}

// ── New / empty-state buttons ─────────────────────────────────────────────
document.getElementById('new-template-btn').addEventListener('click', () => openTemplateModal(null));
document.getElementById('empty-new-template-btn').addEventListener('click', () => openTemplateModal(null));

export function initTemplatesPage() {
  subscribeTemplates(renderTemplatesList);
}

// ── Template card list ────────────────────────────────────────────────────
function renderTemplatesList(templates) {
  templatesList.innerHTML = '';

  if (!templates.length) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  templates.forEach(tmpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const tagsHtml = (tmpl.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
    const subCount = (tmpl.subtasks || []).length;
    const recLabel = RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence;
    card.innerHTML = `
      <div class="template-card-info">
        <div class="template-card-title">${esc(tmpl.title)}</div>
        ${tmpl.notes ? `<div class="template-card-notes">${esc(tmpl.notes)}</div>` : ''}
        <div class="template-card-meta">
          <span class="recurrence-badge">${esc(recLabel)}</span>
          <span class="priority-badge ${tmpl.priority}">${tmpl.priority}</span>
          ${tagsHtml}
          ${subCount ? `<span class="subtask-progress">${subCount} subtask${subCount > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="template-card-actions">
        <button class="btn btn-ghost tmpl-edit-btn" aria-label="Edit template">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
      </div>`;
    card.querySelector('.tmpl-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      openTemplateModal(tmpl);
    });
    card.addEventListener('click', () => openTemplateModal(tmpl));
    templatesList.appendChild(card);
  });
}

// ── Open / populate modal ─────────────────────────────────────────────────
function openTemplateModal(tmpl) {
  pendingSubtasks = tmpl ? JSON.parse(JSON.stringify(tmpl.subtasks || [])) : [];
  modalTitle.textContent = tmpl ? 'Edit Template' : 'New Template';
  tmplIdInput.value     = tmpl?.id || '';
  titleInput.value      = tmpl?.title || '';
  notesInput.value      = tmpl?.notes || '';
  tagsInput.value       = (tmpl?.tags || []).join(', ');
  setPriority(tmpl?.priority || 'medium');
  setRecurrence(tmpl?.recurrence || 'daily');
  deleteBtn.hidden = !tmpl;
  renderSubtasks();
  overlay.hidden = false;
  requestAnimationFrame(() => {
    const body = overlay.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
    titleInput.focus();
  });
}

// ── Subtask list with inline editing + drag-to-reorder ───────────────────
function renderSubtasks() {
  subtaskList.innerHTML = '';
  pendingSubtasks.forEach((st, i) => {
    const item = document.createElement('div');
    item.className = 'subtask-item tmpl-subtask-item';
    item.draggable = true;
    item.dataset.index = i;
    item.innerHTML = `
      <span class="tmpl-subtask-drag" aria-hidden="true" title="Drag to reorder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
      </span>
      <input
        type="text"
        class="tmpl-subtask-inline-input"
        value="${esc(st.title)}"
        aria-label="Subtask ${i + 1}"
        autocomplete="off"
      />
      <button type="button" class="subtask-delete-btn" aria-label="Remove subtask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    // Inline edit — update model on change
    const inlineInput = item.querySelector('.tmpl-subtask-inline-input');
    inlineInput.addEventListener('input', () => {
      pendingSubtasks[i].title = inlineInput.value;
    });
    inlineInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); newSubtaskInput.focus(); }
    });

    // Delete
    item.querySelector('.subtask-delete-btn').addEventListener('click', () => {
      pendingSubtasks.splice(i, 1);
      renderSubtasks();
    });

    // Drag-to-reorder
    item.addEventListener('dragstart', e => {
      dragSrcIndex = i;
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      subtaskList.querySelectorAll('.tmpl-subtask-item').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      subtaskList.querySelectorAll('.tmpl-subtask-item').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      const moved = pendingSubtasks.splice(dragSrcIndex, 1)[0];
      pendingSubtasks.splice(i, 0, moved);
      dragSrcIndex = null;
      renderSubtasks();
    });

    subtaskList.appendChild(item);
  });
}

// ── Add subtask ──────────────────────────────────────────────────────────
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

// ── Close modal ──────────────────────────────────────────────────────────
function closeModal() {
  overlay.hidden = true;
  form.reset();
  subtaskList.innerHTML = '';
  pendingSubtasks = [];
  // reset visual controls back to defaults
  setPriority('medium');
  setRecurrence('daily');
}

cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

// ── Delete template ───────────────────────────────────────────────────────
deleteBtn.addEventListener('click', async () => {
  const id = tmplIdInput.value;
  if (!id) return;
  if (!confirm('Delete this template? Previously created tasks will remain.')) return;
  await deleteTemplate(id);
  closeModal();
});

// ── Save template ─────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }
  const fields = {
    title,
    notes:      notesInput.value.trim(),
    priority:   priorityHidden.value,
    recurrence: recurrenceHidden.value,
    tags:       tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    subtasks:   pendingSubtasks
  };
  const id = tmplIdInput.value;
  if (id) {
    await saveTemplate(id, fields);
  } else {
    await addTemplate(fields);
  }
  closeModal();
});

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { subscribeTemplates, addTemplate, saveTemplate, deleteTemplate } from './store.js';
import { RECURRENCE_LABELS } from './models.js';

const grid             = document.getElementById('templates-grid');
const overlay          = document.getElementById('tmpl-modal-overlay');
const modalTitle       = document.getElementById('tmpl-modal-title');
const form             = document.getElementById('tmpl-form');
const editId           = document.getElementById('tmpl-edit-id');
const titleInput       = document.getElementById('tmpl-title');
const prioritySel      = document.getElementById('tmpl-priority');
const recurrSel        = document.getElementById('tmpl-recurrence');
const tagsInput        = document.getElementById('tmpl-tags');
const notesInput       = document.getElementById('tmpl-notes');
const subtaskList      = document.getElementById('tmpl-subtask-list');
const newSubInput      = document.getElementById('tmpl-new-subtask-input');
const addSubBtn        = document.getElementById('tmpl-add-subtask-btn');
const deleteBtn        = document.getElementById('tmpl-delete-btn');
const carryForwardInput= document.getElementById('tmpl-carry-forward');

let _subtasks = [];

// ── Helpers ────────────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseTags(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Subtask UI ──────────────────────────────────────────────────────────────────────────

function renderSubtasks() {
  subtaskList.innerHTML = '';
  _subtasks.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'subtask-modal-item';
    row.innerHTML = `
      <span class="subtask-modal-label">${escHtml(s.title)}</span>
      <button type="button" class="icon-btn" aria-label="Remove subtask" data-remove="${i}" style="margin-left:auto;width:24px;height:24px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    row.querySelector('[data-remove]').addEventListener('click', () => {
      _subtasks.splice(i, 1);
      renderSubtasks();
    });
    subtaskList.appendChild(row);
  });
}

function addSubtask() {
  const title = newSubInput.value.trim();
  if (!title) return;
  _subtasks.push({ id: crypto.randomUUID(), title, completed: false });
  newSubInput.value = '';
  renderSubtasks();
  newSubInput.focus();
}

addSubBtn.addEventListener('click', addSubtask);
newSubInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
});

// ── Modal open / close ────────────────────────────────────────────────────────────────

function openModal(tmpl = null) {
  editId.value          = tmpl ? tmpl.id : '';
  modalTitle.textContent= tmpl ? 'Edit Template' : 'New Template';
  titleInput.value      = tmpl ? tmpl.title              : '';
  prioritySel.value     = tmpl ? (tmpl.priority   || 'medium') : 'medium';
  recurrSel.value       = tmpl ? (tmpl.recurrence || 'daily')  : 'daily';
  tagsInput.value       = tmpl ? (tmpl.tags || []).join(', ')  : '';
  notesInput.value      = tmpl ? (tmpl.notes || '')            : '';
  _subtasks             = tmpl ? [...(tmpl.subtasks || [])]    : [];

  // Carry Forward — read from template, default false
  if (carryForwardInput) carryForwardInput.checked = !!(tmpl?.carryForward);

  renderSubtasks();
  deleteBtn.style.visibility = tmpl ? 'visible' : 'hidden';
  overlay.hidden = false;
  requestAnimationFrame(() => titleInput.focus());
}

function closeModal() {
  overlay.hidden = true;
  form.reset();
  _subtasks = [];
  subtaskList.innerHTML = '';
  // Reset carry forward checkbox
  if (carryForwardInput) carryForwardInput.checked = false;
}

document.getElementById('new-template-btn').addEventListener('click', () => openModal());
document.getElementById('tmpl-modal-close').addEventListener('click', closeModal);
document.getElementById('tmpl-modal-cancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

// ── Form submit ─────────────────────────────────────────────────────────────────────────

form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }

  const fields = {
    title,
    priority:     prioritySel.value,
    recurrence:   recurrSel.value,
    tags:         parseTags(tagsInput.value),
    notes:        notesInput.value.trim(),
    subtasks:     [..._subtasks],
    carryForward: carryForwardInput ? carryForwardInput.checked : false
  };

  const id = editId.value;
  if (id) {
    await saveTemplate(id, fields);
  } else {
    await addTemplate(fields);
  }
  closeModal();
});

// ── Delete ─────────────────────────────────────────────────────────────────────────────

deleteBtn.addEventListener('click', async () => {
  const id = editId.value;
  if (!id) return;
  if (!confirm('Delete this template? Tasks already created will not be affected.')) return;
  await deleteTemplate(id);
  closeModal();
});

// ── Render grid ──────────────────────────────────────────────────────────────────────────

function renderGrid(templates) {
  if (!templates.length) {
    grid.innerHTML = `
      <div class="template-empty" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <h3>No templates yet</h3>
        <p>Create a template to automatically add recurring tasks to your board.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  templates.forEach(tmpl => {
    const card = document.createElement('div');
    card.className = 'template-card';

    const recurrLabel = RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence || 'Daily (Mon–Fri)';
    const tagsHtml = (tmpl.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');
    const subtaskCount = (tmpl.subtasks || []).length;
    const subtasksHtml = subtaskCount
      ? `<span class="subtask-progress">${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}</span>`
      : '';
    const priority = tmpl.priority || 'medium';
    const carryBadge = tmpl.carryForward
      ? `<span class="carry-forward-badge" title="Carry Forward enabled">↻ Carry Forward</span>`
      : '';

    card.innerHTML = `
      <div class="template-card-info">
        <div class="template-card-title">${escHtml(tmpl.title)}</div>
        ${tmpl.notes ? `<div class="template-card-notes">${escHtml(tmpl.notes)}</div>` : ''}
        <div class="template-card-meta">
          <span class="recurrence-badge">${escHtml(recurrLabel)}</span>
          <span class="priority-badge ${priority}">${priority}</span>
          ${tagsHtml}
          ${subtasksHtml}
          ${carryBadge}
        </div>
      </div>
      <div class="template-card-actions">
        <button class="tmpl-edit-btn" aria-label="Edit ${escHtml(tmpl.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
      </div>`;

    card.querySelector('.tmpl-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      openModal(tmpl);
    });
    card.addEventListener('click', () => openModal(tmpl));
    grid.appendChild(card);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────────────

export function initTemplatesPage() {
  subscribeTemplates(templates => renderGrid(templates));
}

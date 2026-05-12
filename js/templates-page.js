import {
  addTemplate, saveTemplate, deleteTemplate, subscribeTemplates
} from './store.js';
import { createSubtask, RECURRENCE_LABELS } from './models.js';

const overlay      = document.getElementById('tmpl-modal-overlay');
const form         = document.getElementById('tmpl-form');
const tmplIdInput  = document.getElementById('tmpl-id');
const titleInput   = document.getElementById('tmpl-title');
const priorityInput    = document.getElementById('tmpl-priority');
const recurrenceInput  = document.getElementById('tmpl-recurrence');
const tagsInput        = document.getElementById('tmpl-tags');
const subtaskList      = document.getElementById('tmpl-subtask-list');
const newSubtaskInput  = document.getElementById('tmpl-new-subtask');
const addSubtaskBtn    = document.getElementById('tmpl-add-subtask-btn');
const deleteBtn    = document.getElementById('tmpl-delete-btn');
const cancelBtn    = document.getElementById('tmpl-cancel');
const closeBtn     = document.getElementById('tmpl-modal-close');
const modalTitle   = document.getElementById('tmpl-modal-title');
const templatesList = document.getElementById('templates-list');
const emptyState    = document.getElementById('templates-empty');

let pendingSubtasks = [];

document.getElementById('new-template-btn').addEventListener('click', () => openTemplateModal(null));
document.getElementById('empty-new-template-btn').addEventListener('click', () => openTemplateModal(null));

export function initTemplatesPage() {
  subscribeTemplates(renderTemplatesList);
}

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
    card.innerHTML = `
      <div class="template-card-info">
        <div class="template-card-title">${esc(tmpl.title)}</div>
        <div class="template-card-meta">
          <span class="recurrence-badge">${esc(RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence)}</span>
          <span class="priority-badge ${tmpl.priority}">${tmpl.priority}</span>
          ${tagsHtml}
          ${subCount ? `<span class="subtask-progress">${subCount} subtask${subCount>1?'s':''}</span>` : ''}
        </div>
      </div>
      <div class="template-card-actions">
        <button class="btn btn-ghost" style="padding:.4rem .8rem;font-size:var(--text-xs)" aria-label="Edit template">Edit</button>
      </div>`;
    card.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openTemplateModal(tmpl);
    });
    card.addEventListener('click', () => openTemplateModal(tmpl));
    templatesList.appendChild(card);
  });
}

function openTemplateModal(tmpl) {
  pendingSubtasks = tmpl ? JSON.parse(JSON.stringify(tmpl.subtasks || [])) : [];
  modalTitle.textContent = tmpl ? 'Edit Template' : 'New Template';
  tmplIdInput.value      = tmpl?.id || '';
  titleInput.value       = tmpl?.title || '';
  priorityInput.value    = tmpl?.priority || 'medium';
  recurrenceInput.value  = tmpl?.recurrence || 'daily';
  tagsInput.value        = (tmpl?.tags || []).join(', ');
  deleteBtn.hidden       = !tmpl;
  renderSubtasks();
  overlay.hidden = false;
  // slight delay so the sheet animation finishes before we scroll to top
  requestAnimationFrame(() => {
    const body = overlay.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
    titleInput.focus();
  });
}

function renderSubtasks() {
  subtaskList.innerHTML = '';
  pendingSubtasks.forEach((st, i) => {
    const item = document.createElement('div');
    item.className = 'subtask-item';
    item.innerHTML = `
      <span style="flex:1">${esc(st.title)}</span>
      <button type="button" class="subtask-delete-btn" aria-label="Remove subtask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    item.querySelector('.subtask-delete-btn').addEventListener('click', () => {
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
  form.reset();
  subtaskList.innerHTML = '';
  pendingSubtasks = [];
}

cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

deleteBtn.addEventListener('click', async () => {
  const id = tmplIdInput.value;
  if (!id) return;
  if (!confirm('Delete this template? Previously created tasks will remain.')) return;
  await deleteTemplate(id);
  closeModal();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }
  const fields = {
    title,
    priority:   priorityInput.value,
    recurrence: recurrenceInput.value,
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

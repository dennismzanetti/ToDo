/**
 * settings.js
 * -----------
 * Wires up the Settings page:
 *   - Account   : Guest placeholder (Firebase Auth not yet implemented)
 *   - Display   : theme + default view (localStorage)
 *   - Data      : Export all data as JSON / Import from backup
 *   - About     : latest commit info from GitHub API
 */

import './theme.js';
import { applyTheme } from './theme.js';
import { db } from './firebase.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* sandboxed — ignore */ }
}

function showStatus(el, message, durationMs = 2500) {
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, durationMs);
}

// Firestore Timestamp → plain object for JSON serialisation
function tsToPlain(val) {
  if (val && typeof val.toDate === 'function') {
    return { _type: 'timestamp', iso: val.toDate().toISOString() };
  }
  return val;
}

// Recursively convert all Timestamp values in an object
function serializeDoc(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') {
      out[k] = tsToPlain(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item && typeof item === 'object' ? serializeDoc(item) : item
      );
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = serializeDoc(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Convert plain { _type:'timestamp', iso: '...' } back to Firestore Timestamp
async function deserializeDoc(data) {
  const { Timestamp } = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
  );
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && v._type === 'timestamp') {
      out[k] = Timestamp.fromDate(new Date(v.iso));
    } else if (Array.isArray(v)) {
      out[k] = await Promise.all(v.map(item =>
        item && typeof item === 'object' ? deserializeDoc(item) : item
      ));
    } else if (v && typeof v === 'object') {
      out[k] = await deserializeDoc(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Account section ───────────────────────────────────────────────────────────

(function initAccount() {
  const nameEl     = document.getElementById('settingsUserName');
  const emailEl    = document.getElementById('settingsUserEmail');
  const initialsEl = document.getElementById('settingsUserInitials');
  const signOutBtn = document.getElementById('settingsSignOutBtn');

  if (nameEl)     nameEl.textContent  = 'Guest';
  if (emailEl)    emailEl.textContent = 'Sign-in coming soon';
  if (initialsEl) {
    initialsEl.textContent   = 'G';
    initialsEl.style.display = 'flex';
  }
  if (signOutBtn) {
    signOutBtn.disabled          = true;
    signOutBtn.title             = 'Sign-in not yet available';
    signOutBtn.style.opacity     = '0.45';
    signOutBtn.style.cursor      = 'not-allowed';
  }
})();

// ── Display section ───────────────────────────────────────────────────────────

(function initDisplay() {
  const themeSelect = document.getElementById('settingsThemeSelect');
  const viewSelect  = document.getElementById('settingsDefaultViewSelect');
  const saveBtn     = document.getElementById('settingsSaveDisplayBtn');
  const statusEl    = document.getElementById('settingsDisplayStatus');

  if (themeSelect) themeSelect.value = lsGet('theme') || 'system';
  if (viewSelect)  viewSelect.value  = lsGet('defaultView') || 'index.html';

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chosenTheme = themeSelect ? themeSelect.value : 'system';
      const chosenView  = viewSelect  ? viewSelect.value  : 'index.html';

      if (chosenTheme === 'system') {
        try { localStorage.removeItem('theme'); } catch { /* ignore */ }
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
      } else {
        lsSet('theme', chosenTheme);
        applyTheme(chosenTheme);
      }

      lsSet('defaultView', chosenView);
      if (statusEl) showStatus(statusEl, '✓ Saved');
    });
  }
})();

// ── Export & Import section ───────────────────────────────────────────────────

(function initDataSection() {
  const exportBtn       = document.getElementById('exportDataBtn');
  const importInput     = document.getElementById('importFileInput');
  const confirmBox      = document.getElementById('importConfirmBox');
  const confirmMsg      = document.getElementById('importConfirmMsg');
  const confirmBtn      = document.getElementById('importConfirmBtn');
  const cancelBtn       = document.getElementById('importCancelBtn');
  const statusEl        = document.getElementById('exportImportStatus');

  // Holds parsed import data while waiting for user confirmation
  let pendingImport = null;

  // ── Export ────────────────────────────────────────────────────────────────
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting…';
      if (statusEl) statusEl.style.display = 'none';

      try {
        const [tasksSnap, templatesSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'templates')),
          getDocs(collection(db, 'categories'))
        ]);

        const backup = {
          exportedAt: new Date().toISOString(),
          version: 1,
          tasks:      tasksSnap.docs.map(d      => ({ id: d.id, ...serializeDoc(d.data()) })),
          templates:  templatesSnap.docs.map(d  => ({ id: d.id, ...serializeDoc(d.data()) })),
          categories: categoriesSnap.docs.map(d => ({ id: d.id, ...serializeDoc(d.data()) }))
        };

        const json     = JSON.stringify(backup, null, 2);
        const blob     = new Blob([json], { type: 'application/json' });
        const url      = URL.createObjectURL(blob);
        const dateStr  = new Date().toISOString().slice(0, 10);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = `todo-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const total = backup.tasks.length + backup.templates.length + backup.categories.length;
        if (statusEl) showStatus(statusEl, `✓ Exported ${total} records`);
      } catch (err) {
        console.error('Export failed:', err);
        if (statusEl) showStatus(statusEl, '✗ Export failed. See console for details.', 4000);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = '⇩ Export All Data';
      }
    });
  }

  // ── Import: file selected ─────────────────────────────────────────────────
  if (importInput) {
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      if (!file) return;
      if (statusEl) statusEl.style.display = 'none';
      if (confirmBox) confirmBox.style.display = 'none';

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Basic shape validation
        if (!Array.isArray(data.tasks) || !Array.isArray(data.templates) || !Array.isArray(data.categories)) {
          throw new Error('Invalid backup file — missing tasks, templates, or categories arrays.');
        }

        pendingImport = data;

        const summary = [
          `${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''}`,
          `${data.templates.length} template${data.templates.length !== 1 ? 's' : ''}`,
          `${data.categories.length} categor${data.categories.length !== 1 ? 'ies' : 'y'}`
        ].join(', ');

        if (confirmMsg) {
          confirmMsg.textContent =
            `This will DELETE all current data and replace it with: ${summary}. This cannot be undone. Continue?`;
        }
        if (confirmBox) confirmBox.style.display = 'block';

      } catch (err) {
        console.error('Import parse error:', err);
        if (statusEl) showStatus(statusEl, `✗ ${err.message}`, 5000);
        pendingImport = null;
      }

      // Reset file input so the same file can be re-selected
      importInput.value = '';
    });
  }

  // ── Import: confirmed ─────────────────────────────────────────────────────
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pendingImport) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Importing…';
      if (statusEl) statusEl.style.display = 'none';

      try {
        const COLLECTIONS = ['tasks', 'templates', 'categories'];

        // Step 1: delete all existing docs in each collection
        for (const col of COLLECTIONS) {
          const snap = await getDocs(collection(db, col));
          // Firestore batch limit is 500 — chunk if needed
          const refs = snap.docs.map(d => d.ref);
          for (let i = 0; i < refs.length; i += 400) {
            const batch = writeBatch(db);
            refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
            await batch.commit();
          }
        }

        // Step 2: write backup docs into each collection
        for (const col of COLLECTIONS) {
          const items = pendingImport[col] || [];
          for (let i = 0; i < items.length; i += 400) {
            const batch = writeBatch(db);
            for (const item of items.slice(i, i + 400)) {
              const { id, ...fields } = item;
              const deserialized = await deserializeDoc(fields);
              // Re-use the original Firestore doc ID so references stay intact
              batch.set(doc(db, col, id), deserialized);
            }
            await batch.commit();
          }
        }

        const total =
          (pendingImport.tasks?.length      || 0) +
          (pendingImport.templates?.length  || 0) +
          (pendingImport.categories?.length || 0);

        if (statusEl) showStatus(statusEl, `✓ Imported ${total} records successfully`, 4000);

      } catch (err) {
        console.error('Import failed:', err);
        if (statusEl) showStatus(statusEl, '✗ Import failed. See console for details.', 5000);
      } finally {
        pendingImport = null;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, import';
        if (confirmBox) confirmBox.style.display = 'none';
      }
    });
  }

  // ── Import: cancelled ─────────────────────────────────────────────────────
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      pendingImport = null;
      if (confirmBox) confirmBox.style.display = 'none';
    });
  }
})();

// ── About section ─────────────────────────────────────────────────────────────

(async function initAbout() {
  const aboutEl = document.getElementById('settingsAboutContent');
  if (!aboutEl) return;

  try {
    const res = await fetch(
      'https://api.github.com/repos/dennismzanetti/ToDo/commits/main',
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    const sha       = data.sha.slice(0, 7);
    const fullSha   = data.sha;
    const msg       = data.commit.message.split('\n')[0];
    const formatted = new Date(data.commit.committer.date).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    aboutEl.innerHTML = `
      <dl class="settings-about-dl">
        <div class="settings-about-row">
          <dt>App</dt><dd>To-Do List</dd>
        </div>
        <div class="settings-about-row">
          <dt>Latest commit</dt>
          <dd><a href="https://github.com/dennismzanetti/ToDo/commit/${fullSha}"
               target="_blank" rel="noopener noreferrer"
               class="build-sha">${sha}</a></dd>
        </div>
        <div class="settings-about-row">
          <dt>Commit message</dt><dd>${msg}</dd>
        </div>
        <div class="settings-about-row">
          <dt>Date</dt><dd>${formatted}</dd>
        </div>
        <div class="settings-about-row">
          <dt>Repository</dt>
          <dd><a href="https://github.com/dennismzanetti/ToDo"
               target="_blank" rel="noopener noreferrer">dennismzanetti/ToDo</a></dd>
        </div>
      </dl>`;
  } catch {
    aboutEl.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);">Build info unavailable.</p>';
  }
})();

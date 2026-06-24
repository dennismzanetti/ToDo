/**
 * settings.js
 * -----------
 * Wires up the Settings page:
 *   - Account   : shows Guest state (Firebase Auth not yet implemented)
 *   - Display   : theme select (reads/writes localStorage 'theme')
 *                 default view select (reads/writes localStorage 'defaultView')
 *   - About     : pulls latest commit info from the GitHub API (same as version.js)
 *
 * Note: Export & Import (Step 3) will be added in a subsequent commit.
 */

import './theme.js';
import { applyTheme } from './theme.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* sandboxed — ignore */ }
}

function showStatus(el, message, durationMs = 2000) {
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, durationMs);
}

// ── Account section ───────────────────────────────────────────────────────────
// Firebase Auth is not yet implemented in this app.
// Render a "Guest" placeholder so the section is never empty.

(function initAccount() {
  const nameEl     = document.getElementById('settingsUserName');
  const emailEl    = document.getElementById('settingsUserEmail');
  const initialsEl = document.getElementById('settingsUserInitials');
  const signOutBtn = document.getElementById('settingsSignOutBtn');

  if (nameEl)     nameEl.textContent  = 'Guest';
  if (emailEl)    emailEl.textContent = 'Sign-in coming soon';
  if (initialsEl) {
    initialsEl.textContent    = 'G';
    initialsEl.style.display  = 'flex';
  }

  // Sign-out button: disabled until Auth is wired
  if (signOutBtn) {
    signOutBtn.disabled = true;
    signOutBtn.title    = 'Sign-in not yet available';
    signOutBtn.style.opacity = '0.45';
    signOutBtn.style.cursor  = 'not-allowed';
  }
})();

// ── Display section ───────────────────────────────────────────────────────────

(function initDisplay() {
  const themeSelect   = document.getElementById('settingsThemeSelect');
  const viewSelect    = document.getElementById('settingsDefaultViewSelect');
  const saveBtn       = document.getElementById('settingsSaveDisplayBtn');
  const statusEl      = document.getElementById('settingsDisplayStatus');

  // --- Pre-populate from localStorage ---

  // Theme: 'light' | 'dark' | null (null → "system")
  const savedTheme = lsGet('theme');
  if (themeSelect) {
    themeSelect.value = savedTheme || 'system';
  }

  // Default view: e.g. 'index.html' | 'todo-list.html' | 'templates.html'
  const savedView = lsGet('defaultView') || 'index.html';
  if (viewSelect) {
    viewSelect.value = savedView;
  }

  // --- Save handler ---
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chosenTheme = themeSelect ? themeSelect.value : 'system';
      const chosenView  = viewSelect  ? viewSelect.value  : 'index.html';

      // Persist theme
      if (chosenTheme === 'system') {
        // Remove override — let OS decide
        try { localStorage.removeItem('theme'); } catch { /* ignore */ }
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
      } else {
        lsSet('theme', chosenTheme);
        applyTheme(chosenTheme);
      }

      // Persist default view
      lsSet('defaultView', chosenView);

      if (statusEl) showStatus(statusEl, '✓ Saved');
    });
  }
})();

// ── About section ─────────────────────────────────────────────────────────────
// Replicates the same GitHub API call used by version.js so the About card
// shows the same build info without depending on the footer badge element.

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
    const dateObj   = new Date(data.commit.committer.date);
    const formatted = dateObj.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    aboutEl.innerHTML = `
      <dl class="settings-about-dl">
        <div class="settings-about-row">
          <dt>App</dt>
          <dd>To-Do List</dd>
        </div>
        <div class="settings-about-row">
          <dt>Latest commit</dt>
          <dd>
            <a href="https://github.com/dennismzanetti/ToDo/commit/${fullSha}"
               target="_blank" rel="noopener noreferrer"
               class="build-sha">${sha}</a>
          </dd>
        </div>
        <div class="settings-about-row">
          <dt>Commit message</dt>
          <dd>${msg}</dd>
        </div>
        <div class="settings-about-row">
          <dt>Date</dt>
          <dd>${formatted}</dd>
        </div>
        <div class="settings-about-row">
          <dt>Repository</dt>
          <dd>
            <a href="https://github.com/dennismzanetti/ToDo"
               target="_blank" rel="noopener noreferrer">
              dennismzanetti/ToDo
            </a>
          </dd>
        </div>
      </dl>
    `;
  } catch {
    aboutEl.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);">Build info unavailable.</p>';
  }
})();

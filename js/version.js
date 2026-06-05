(async () => {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  try {
    const res = await fetch('https://api.github.com/repos/dennismzanetti/ToDo/commits/main', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const sha = data.sha.slice(0, 7);
    const msg = data.commit.message.split('\n')[0];
    const date = new Date(data.commit.committer.date);
    const formatted = date.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const isMobile = window.matchMedia('(max-width: 479px)').matches;
    if (isMobile) {
      badge.innerHTML = `
        <span class="version-top-line">
          <a href="https://github.com/dennismzanetti/ToDo/commit/${data.sha}" target="_blank" rel="noopener noreferrer" class="version-sha">${sha}</a>
          <span class="version-msg">${msg}</span>
        </span>
        <span class="version-bottom-line">${formatted}</span>
      `;
    } else {
      badge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px"><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>
        <a href="https://github.com/dennismzanetti/ToDo/commit/${data.sha}" target="_blank" rel="noopener noreferrer" class="version-sha">${sha}</a>
        &mdash; ${msg} &mdash; ${formatted}
      `;
    }
  } catch {
    badge.textContent = 'Version unavailable';
  }
})();

/**
 * app.js — CountUp core application logic
 *
 * Manages the task state, renders the UI, and coordinates
 * syncing with GitHub Gist via gist.js.
 */

(() => {
  const APP_VERSION = 'v9';

  // ─── State ───────────────────────────────────────────────────────────────
  let tasks = [];           // [{ id, name, lastDone }]
  let syncTimer = null;
  let pendingSync = false;  // track offline changes

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function daysSince(isoString) {
    const last = new Date(isoString).setHours(0, 0, 0, 0);
    const now  = new Date().setHours(0, 0, 0, 0);
    return Math.floor((now - last) / 86_400_000);
  }

  function fmtDate(isoString) {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  // ─── Persistence (localStorage fallback) ─────────────────────────────────

  function saveLocal() {
    localStorage.setItem('cu_tasks', JSON.stringify(tasks));
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem('cu_tasks') || '[]');
    } catch { return []; }
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  function showSync(msg, type = '') {
    const el = document.getElementById('sync-status');
    el.textContent = msg;
    el.className = `sync-status${type ? ' ' + type : ''}`;
    el.classList.remove('hidden');
  }

  function clearSync() {
    const el = document.getElementById('sync-status');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  async function syncToGist() {
    if (!Gist.getToken()) return;  // no token — silent skip
    showSync('Saving…');
    try {
      const gistId = await Gist.save({ tasks });
      // If a new Gist was created, update the settings input
      const gistInput = document.getElementById('gist-id');
      if (gistInput && !gistInput.value) gistInput.value = gistId;
      showSync('Saved ✓', 'ok');
      pendingSync = false;
      clearSync();
    } catch (err) {
      showSync(`Sync error: ${err.message}`, 'error');
      pendingSync = true;
    }
  }

  function scheduleSyncToGist() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToGist, 800);
  }

  async function loadFromGist() {
    if (!Gist.getToken() || !Gist.getGistId()) return;
    showSync('Loading from Gist…');
    try {
      const data = await Gist.load();
      if (data && Array.isArray(data.tasks)) {
        tasks = data.tasks;
        saveLocal();
      }
      showSync('Synced ✓', 'ok');
      clearSync();
    } catch (err) {
      showSync(`Load error: ${err.message}`, 'error');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function render() {
    const list  = document.getElementById('task-list');
    const empty = document.getElementById('empty-state');

    list.innerHTML = '';

    if (tasks.length === 0) {
      empty.classList.remove('hidden');
      empty.style.display = '';
      return;
    }
    empty.classList.add('hidden');
    empty.style.display = 'none';

    // Sort: most days first
    const sorted = [...tasks].sort((a, b) => daysSince(b.lastDone) - daysSince(a.lastDone));

    sorted.forEach(task => {
      const days = daysSince(task.lastDone);
      let daysClass = '';
      if (days === 0) daysClass = 'today';
      else if (days >= 7) daysClass = 'urgent';

      const li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;
      li.innerHTML = `
        <div class="task-days ${daysClass}" title="Days since last done">
          ${days}
        </div>
        <div class="task-info">
          <div class="task-name" data-id="${task.id}" title="Click to rename" tabindex="0" role="button">${escHtml(task.name)}</div>
          <div class="task-label">
            ${days === 0 ? 'Done today' : days === 1 ? '1 day ago' : `${days} days ago`}
            &nbsp;·&nbsp; ${fmtDate(task.lastDone)}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-done" data-id="${task.id}">Done ✓</button>
          <button class="btn-delete" data-id="${task.id}" title="Delete task">✕</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Task actions ─────────────────────────────────────────────────────────

  function addTask(name) {
    tasks.push({ id: genId(), name: name.trim(), lastDone: new Date().toISOString() });
    saveLocal();
    render();
    scheduleSyncToGist();
  }

  function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.lastDone = new Date().toISOString();
    saveLocal();
    render();
    scheduleSyncToGist();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveLocal();
    render();
    scheduleSyncToGist();
  }

  function renameTask(id, newName) {
    newName = newName.trim();
    if (!newName) return;
    const task = tasks.find(t => t.id === id);
    if (!task || task.name === newName) return;
    task.name = newName;
    saveLocal();
    render();
    scheduleSyncToGist();
  }

  function startRename(nameEl) {
    const id = nameEl.dataset.id;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-name-input';
    input.value = task.name;
    input.maxLength = 120;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const newName = input.value.trim();
      // Replace input back with the (possibly updated) name div
      input.removeEventListener('blur', commit);
      renameTask(id, newName || task.name);
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = task.name; input.blur(); }
    });
  }

  // ─── Settings panel ───────────────────────────────────────────────────────

  function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    document.getElementById('gh-token').value  = Gist.getToken();
    document.getElementById('gist-id').value   = Gist.getGistId();
    document.getElementById('settings-feedback').classList.add('hidden');
    document.getElementById('app-version').textContent = APP_VERSION;
    overlay.style.display = '';
    overlay.classList.remove('hidden');
    document.getElementById('gh-token').focus();
  }

  function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }

  async function saveSettings() {
    const token  = document.getElementById('gh-token').value.trim();
    const gistId = document.getElementById('gist-id').value.trim();
    const fb     = document.getElementById('settings-feedback');

    if (!token) {
      showFeedback(fb, 'Please enter a GitHub token.', 'error');
      return;
    }

    showFeedback(fb, 'Validating token…', '');
    try {
      const login = await Gist.validateToken(token);
      Gist.saveCredentials(token, gistId);
      showFeedback(fb, `Connected as @${login}. Settings saved!`, 'ok');
      // Reload from Gist with the new credentials
      setTimeout(async () => {
        closeSettings();
        await loadFromGist();
        render();
      }, 1200);
    } catch (err) {
      showFeedback(fb, err.message, 'error');
    }
  }

  function showFeedback(el, msg, type) {
    el.textContent = msg;
    el.className = `feedback${type ? ' ' + type : ''}`;
    el.classList.remove('hidden');
  }

  // ─── Event wiring ─────────────────────────────────────────────────────────

  function init() {
    // Ensure settings overlay is hidden regardless of CSS load state
    closeSettings();

    // Load local data first (instant)
    tasks = loadLocal();
    render();

    // Then sync from Gist if credentials are available
    loadFromGist().then(render);

    // Add task form
    document.getElementById('add-task-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('task-input');
      const name  = input.value.trim();
      if (!name) return;
      addTask(name);
      input.value = '';
      input.focus();
    });

    // Task list (event delegation)
    document.getElementById('task-list').addEventListener('click', e => {
      const doneBtn   = e.target.closest('.btn-done');
      const deleteBtn = e.target.closest('.btn-delete');
      const nameEl    = e.target.closest('.task-name');
      if (doneBtn)   completeTask(doneBtn.dataset.id);
      if (deleteBtn) deleteTask(deleteBtn.dataset.id);
      if (nameEl)    startRename(nameEl);
    });

    document.getElementById('task-list').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('task-name')) {
        e.preventDefault();
        startRename(e.target);
      }
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-save').addEventListener('click', saveSettings);
    document.getElementById('settings-cancel').addEventListener('click', closeSettings);
    document.getElementById('settings-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeSettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSettings();
    });

    // Re-render periodically so day counts stay current overnight
    setInterval(render, 60_000);

    // Sync pending changes when coming back online
    window.addEventListener('online', () => {
      if (pendingSync) scheduleSyncToGist();
    });

    // Register service worker and auto-reload when a new version activates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});

      // Only reload when an *existing* controller is *replaced* (i.e. an update).
      // Ignore the first-install case (no previous controller → new controller),
      // which would otherwise cause a reload loop on every first visit.
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/**
 * gist.js — GitHub Gist sync for CountUp
 *
 * Reads and writes a single JSON file ("countup-data.json") inside a Gist.
 * Token and Gist ID are persisted in localStorage.
 */

const Gist = (() => {
  const GIST_FILENAME = 'countup-data.json';
  const API = 'https://api.github.com';

  function getToken() { return localStorage.getItem('cu_token') || ''; }
  function getGistId() { return localStorage.getItem('cu_gist_id') || ''; }

  function saveCredentials(token, gistId) {
    localStorage.setItem('cu_token', token);
    if (gistId) localStorage.setItem('cu_gist_id', gistId);
  }

  function authHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  /** Fetch data from the Gist. Returns parsed object or null. */
  async function load() {
    const token = getToken();
    const gistId = getGistId();
    if (!token || !gistId) return null;

    const res = await fetch(`${API}/gists/${gistId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error ${res.status}`);
    }
    const data = await res.json();
    const file = data.files[GIST_FILENAME];
    if (!file) return null;

    // Gist may give a truncated file — fetch raw if needed
    const content = file.truncated
      ? await fetch(file.raw_url).then(r => r.text())
      : file.content;

    return JSON.parse(content);
  }

  /** Save data to the Gist. Creates a new Gist if no ID is stored. */
  async function save(payload) {
    const token = getToken();
    if (!token) throw new Error('No GitHub token configured. Open Settings to add one.');

    const body = JSON.stringify({
      description: 'CountUp app data',
      public: false,
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) },
      },
    });

    let gistId = getGistId();
    let res;

    if (gistId) {
      // Update existing Gist (PATCH)
      res = await fetch(`${API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body,
      });
    } else {
      // Create new Gist (POST)
      res = await fetch(`${API}/gists`, {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error ${res.status}`);
    }

    const result = await res.json();
    // Persist the newly created Gist ID
    if (!gistId) {
      gistId = result.id;
      localStorage.setItem('cu_gist_id', gistId);
    }
    return gistId;
  }

  /** Validate a token by calling /user. Returns user login or throws. */
  async function validateToken(token) {
    const res = await fetch(`${API}/user`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error('Invalid token or insufficient permissions.');
    const data = await res.json();
    return data.login;
  }

  return { load, save, getToken, getGistId, saveCredentials, validateToken };
})();

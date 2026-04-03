# CountUp

A simple Progressive Web App (PWA) to track recurring tasks and see how many days have passed since you last did them.

## Features

- Add tasks — stamped with the current date
- See the day count for each task, sorted by most overdue
- **Done again** — resets the counter to today
- **Rename** a task by clicking its name
- Syncs across devices via a private **GitHub Gist**
- Works offline (service worker cache)
- Installable on mobile and desktop

---

## First-time setup

1. **Serve or host the app** (see [Hosting](#hosting) below)
2. Open the app and tap ⚙️ (Settings)
3. Create a GitHub Personal Access Token with the `gist` scope:
   [github.com/settings/tokens/new?scopes=gist](https://github.com/settings/tokens/new?scopes=gist&description=CountUp)
4. Paste the token and leave Gist ID blank — a private Gist is created automatically on first save
5. On other devices: enter the same token + the Gist ID shown after the first save

---

## Hosting on GitHub Pages

1. Create a public repo on GitHub (e.g. `countup`)
2. Push this folder:
   ```bash
   git remote add origin git@github.com:YOUR_USERNAME/countup.git
   git push -u origin main
   ```
3. Go to **Settings → Pages → Branch: `main` / `/ (root)` → Save**
4. Your app is live at `https://YOUR_USERNAME.github.io/countup/`
5. On your phone, open the URL and tap **"Add to Home Screen"**

---

## Publishing a new version

Whenever you make changes to the app, follow these steps so all devices receive the update automatically:

### 1. Make your changes

Edit any of the source files (`app.js`, `style.css`, `index.html`, etc.).

### 2. Bump the version in `app.js` and cache name in `sw.js`

Open `app.js` and increment `APP_VERSION` on the second line:

```js
// Before:
const APP_VERSION = 'v5';
// After:
const APP_VERSION = 'v6';
```

Open `sw.js` and increment `CACHE_NAME` on the first line:

```js
// Before:
const CACHE_NAME = 'countup-v5';
// After:
const CACHE_NAME = 'countup-v6';
```

> **Why?** The service worker only re-fetches files when it detects a change in `sw.js`.
> Bumping the cache name is the trigger. If you skip this step, users will keep seeing the old version.
> Keep both version numbers in sync — the version shown in the app (⚙️ Settings) comes from `APP_VERSION`.

### 3. Commit and push

```bash
git add .
git commit -m "Describe your change"
git push
```

GitHub Pages deploys within ~1 minute. Users will receive the update automatically on their next visit — no hard refresh needed.

---

## Local development

```bash
# Any static file server works, e.g.:
npx serve .
# or:
python3 -m http.server 8080
```

Open `http://localhost:3000` (or whichever port). Use **hard refresh** (`Ctrl+Shift+R`) during development to bypass the service worker cache.

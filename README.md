# MBA Interview & GD Intelligence Radar — GitHub Actions edition

This version removes the browser RSS/CORS proxy. A GitHub Action fetches Google News RSS directly every 4 hours, filters/ranks/deduplicates stories, and writes `data/news.json`. GitHub Pages only reads that local JSON.

## Upload
Upload the **contents** of this package to the root of the existing repository, preserving:
- `.github/workflows/update-news.yml`
- `scripts/fetch_news.py`
- `data/news.json`
- `config.json`
- `index.html`
- `app.js`
- `styles.css`

## First run
1. GitHub repository → **Actions**
2. Open **Update news radar**
3. Click **Run workflow** → **Run workflow**
4. Wait for the green check.
5. The action commits the populated `data/news.json`.
6. Open GitHub Pages and hard-refresh.

## Required permission if the action cannot push
Repository → Settings → Actions → General → Workflow permissions → choose **Read and write permissions** → Save. Then rerun the workflow.

## Pages
Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## Tuning
Edit `config.json`. Sources are clustered queries, not one giant keyword query. `negative` rejects generic junk; `business` supplies business-impact anchors; `industries` supplies sector anchors; `players` adds company significance.

The updater deliberately preserves the previous useful snapshot if a run returns zero stories.

# MBA Interview & GD Intelligence Radar

Static GitHub Pages news dashboard. It uses clustered Google News RSS searches, contextual ranking, negative-noise filtering, industry tabs, business-function pivots, geography/score/date filters, and top-player shortcuts.

## Publish
Replace the files in the root of your existing `sip-news-radar` repository with:
- `index.html`
- `styles.css`
- `config.js`
- `app.js`
- `README.md`

Commit to `main`. If GitHub Pages is already configured for `main` / root, the existing site URL will update automatically.

## Ranking / anti-junk logic
A story must have sector context, business-impact context, or a tracked-company match. Generic negative terms (student, admissions, exam results, career advice, entertainment, etc.) reject stories unless meaningful business/sector context exists. RSS queries themselves are also clustered rather than using a single giant OR query.

The score is a 0–100 reading-priority heuristic, not an objective importance claim.

## Note
RSS is fetched client-side through AllOrigins, matching the original architecture. For maximum reliability, the next upgrade should fetch and pre-rank feeds on a scheduled GitHub Action and publish a JSON snapshot.

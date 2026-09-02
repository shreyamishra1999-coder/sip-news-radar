# SIP News Radar

Open `index.html` in a modern browser. It is a self-contained, browser-based daily news desk.

## What it does

- Collects RSS results from the sources in **Manage sources**.
- Sorts each article by your keywords, source priority, and action signals such as deadlines or applications.
- Preserves the original article URL for every story.
- Saves each calendar day as a separate local archive segment (in that browser’s local storage).
- Lets you export the archive as JSON.

## Tailoring it to the shared brief

Open **Edit brief & keywords** and replace the starter brief, keywords, and sources with the resources and requirements from the shared conversation. Each source should use this format:

`Source name | RSS feed URL | priority`

Priority runs from 1 (useful) to 3 (must-read). Google News RSS search links are a convenient way to turn a publication, topic, organisation, or keyword query into a feed.

## Daily operation

Choose **Refresh daily brief** each day. The site deliberately keeps the archive in your browser, so no account or third-party database is needed. To automate unattended refreshing, it would need to be hosted with a small scheduled server job; this static version is ready to publish to any simple web host.


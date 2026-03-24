# MTG Keyword Encyclopedia

[![Netlify Status](https://api.netlify.com/api/v1/badges/9129c7ec-53a7-4c04-832e-4cc8752e2753/deploy-status)](https://app.netlify.com/projects/mtg-keyword/deploys)

An app for browsing and searching all Magic: The Gathering keywords.

## Project structure

```
mtg-keywords/
├── src/
│   ├── mtgKeywords.js       ← all keyword data lives here
│   └── App.jsx              ← the React app (mtg_keywords_app.jsx)
├── index.html
├── package.json
└── vite.config.js
```

## Quick start

### 1. Scaffold a new Vite + React project

```bash
npm create vite@latest mtg-keywords -- --template react
cd mtg-keywords
npm install
```

### 2. Add the mobile viewport meta tag

Make sure `index.html` has this in `<head>` — Vite includes it by default, but double-check:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

`viewport-fit=cover` fills the safe area on notched iPhones correctly.

### 3. Drop in the files

Copy the following into your project:

| File | Destination |
|---|---|
| `mtgKeywords.js` | `src/mtgKeywords.js` |
| `mtg_keywords_app.jsx` | `src/App.jsx` |
| `manifest.json` | `public/manifest.json` |
| `sw.js` | `public/sw.js` |

Remove the boilerplate `src/App.css` and `src/index.css` imports from
`src/main.jsx` if present — the app handles all its own styles inline.

### 4. Wire up the manifest in index.html

Add these two lines inside `<head>` in `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1d2021" />
<!-- iOS home screen support -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MTG Keywords" />
```

### 5. Add app icons

Create a `public/icons/` folder and add two PNG icons:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px

These are displayed on the home screen when the app is installed.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> **Note:** The service worker only activates in production builds (`npm run build && npm run preview`). During dev, the PWA install prompt won't appear — that's normal.

## Features

- **Search** — live filtering across keyword names, descriptions, and set names
- **Filters** — All / Abilities / Actions / Evergreen chips
- **A-Z index bar** — fixed right-side bar for instant alphabetical jumping
- **Tap for details** — bottom sheet modal with swipe-to-dismiss and Scryfall card images
- **Session cache** — Scryfall results cached in `sessionStorage` so repeated lookups are instant
- **PWA** — installable to home screen, works offline for the app shell

## Adding or editing keywords

All data lives in `src/mtgKeywords.js`. Each entry follows this shape:

```js
"Keyword Name": {
  category:  "Keyword ability" | "Keyword action",
  first_set: "Set Name",
  description: "Rules text explaining what the keyword does.",
},
```

Save the file — Vite hot-reloads instantly, no restart needed.

## Tech

- [React](https://react.dev/) (via Vite)
- [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) + [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) (Google Fonts, loaded in-app)
- Colors: [gruvbox dark hard](https://github.com/morhetz/gruvbox) palette
- [Scryfall API](https://scryfall.com/docs/api) for card images
- PWA: Web App Manifest + Service Worker (cache-first shell, network-first API)
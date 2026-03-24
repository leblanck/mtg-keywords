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

Copy `mtgKeywords.js` into `src/` and replace the contents of `src/App.jsx`
with `mtg_keywords_app.jsx`.

Remove the boilerplate `src/App.css` and `src/index.css` imports from
`src/main.jsx` if present — the app handles all its own styles inline.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

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
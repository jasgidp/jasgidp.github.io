# jasgidp.github.io

Personal portfolio (static site on GitHub Pages). Content lives in JSON files and is
edited from a private admin panel — no code changes needed to update the site.

## Structure

- Pages: `index.html`, `about.html`, `portfolio.html`, `skills.html`, `timeline.html`,
  `programming.html`, `contact.html`.
- Shared header: `partials/header.js` (injected into every page).
- i18n (ES/EN/PT): `i18n.js` + `locales/*.json`.
- Content data: `data/*.json` (`projects`, `skills`, `timeline`, `contact`,
  `code-projects`, `repos-config`).
- Renderers: `projects.js`, `skills.js`, `timeline.js`, `contact.js`, `programming.js`,
  `github-repos.js`.

## Editing content (no code)

Open **`/admin.html`** (e.g. `https://jasgidp.github.io/admin.html`). It is not linked in
the nav and is excluded from `robots.txt`/`sitemap.xml`.

1. Create a GitHub **fine-grained personal access token** with:
   - Repository access: only `jasgidp/jasgidp.github.io`
   - Permission: **Contents → Read and write**
   - A short expiration (30–90 days); renew when it lapses.
2. Paste the token in the panel and click **Entrar**. It is stored only in your browser
   (`localStorage`), never in the repo.
3. Edit **Cronología**, **Habilidades**, **Proyectos** or **Proyectos de código**, then
   **Guardar en GitHub**. Each save commits the matching `data/*.json`; GitHub Pages
   redeploys in ~1–2 min for all visitors.
4. Project images: upload from the project card — they are resized and committed to
   `assets/img/projects/`. Remember to Save afterwards so the image path persists.

Use **Previsualizar (local)** to browse the panel read-only without a token.

## GitHub repos on the Programming page

`programming.html` lists all public repos of `jasgidp` automatically (cached ~1h).
Configure visibility in `data/repos-config.json` (`exclude`, `featured`, `hideForks`,
`hideArchived`).

## Local development

Serve over HTTP (the JSON `fetch` calls don't work from `file://`):

```bash
python3 -m http.server 8000
```

See `docs/PROJECTS_EDITING.md` for the full data field reference.

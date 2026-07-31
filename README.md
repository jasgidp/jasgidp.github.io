# Jonathan Sandoval — Portfolio

Personal site of **Jonathan Sandoval**, Product Design Engineer and streaming specialist.  
Live at **[jasgidp.github.io](https://jasgidp.github.io/)**.

Built as a static site on GitHub Pages: no framework, content driven by JSON, editable from a private admin panel.

---

## What’s on the site

| Page | What you’ll find |
|------|------------------|
| [Home](https://jasgidp.github.io/) | Intro, CTAs, social links |
| [About](https://jasgidp.github.io/about.html) | Bio, highlights, quick facts |
| [Portfolio](https://jasgidp.github.io/portfolio.html) | Projects by category (design, engineering, software…) |
| [Programming](https://jasgidp.github.io/programming.html) | Curated code demos + public GitHub repos |
| [Skills](https://jasgidp.github.io/skills.html) | Tools and skills, searchable by group |
| [Timeline](https://jasgidp.github.io/timeline.html) | Experience, research, leadership, education |
| [Contact](https://jasgidp.github.io/contact.html) | Details, socials, and message form |

Languages: **Spanish · English · Portuguese** (switcher in the header).

---

## Project layout

```
jasgidp.github.io/
├── *.html                 Public pages (stable URLs)
├── admin/                 Private editor (not in the nav)
├── css/                   Site styles
├── js/                    Shared + per-page scripts
├── data/                  Editable content (JSON)
├── locales/               i18n strings (es / en / pt)
├── assets/
│   ├── img/brand|profile|projects/
│   └── video/
└── docs/                  CV and editing notes
```

Content files in `data/`:

- `projects.json` — portfolio
- `code-projects.json` — programming demos
- `skills.json` — skills
- `timeline.json` — career timeline
- `contact.json` — contact block
- `repos-config.json` — which GitHub repos to show/hide

---

## Edit content (admin)

Open **[jasgidp.github.io/admin/](https://jasgidp.github.io/admin/)**  
(`/admin.html` redirects there. It is excluded from search engines.)

1. Create a **fine-grained GitHub token**  
   - Repo: only `jasgidp/jasgidp.github.io`  
   - Permission: **Contents → Read and write**  
   - Short expiry (e.g. 30–90 days)
2. Paste the token → **Entrar** (stored only in your browser).
3. Edit **Cronología / Habilidades / Proyectos / Código** → **Guardar en GitHub**.
4. Wait ~1–2 minutes for Pages to deploy, then hard-refresh the public page (`Cmd+Shift+R`).

**Preview (local)** opens the editor read-only without a token.  
Project images uploaded in admin go to `assets/img/projects/`.

Field reference: [`docs/PROJECTS_EDITING.md`](docs/PROJECTS_EDITING.md).

---

## Run locally

JSON `fetch` needs HTTP (not `file://`):

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).  
Admin: [http://localhost:8000/admin/](http://localhost:8000/admin/).

---

## Notes

- Public pages stay at the repo root so existing links and SEO keep working.
- The Programming page also lists public GitHub repos (cached ~1 hour); tune visibility in `data/repos-config.json`.
- Analytics loads only on public pages, not on `/admin/`.

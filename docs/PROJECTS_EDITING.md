# Editing projects easily

This site reads projects from `data/projects.json`. You can edit that one file to update the portfolio. No build step required.

## Quick steps
1. Open `data/projects.json`.
2. Each item inside the `projects` array is one project.
3. Edit fields or copy the template below to add a new project.
4. Save and refresh the Portfolio page.

## Field reference (all optional unless noted)
- id (string, required): unique identifier (slug-like)
- title (string, required): project name
- summary (string): short description
- category (string): one of graphic | experience | engineering | research | software | design
- year (number): year shown next to the title
- status (string): e.g., Live, Completed, In progress, Concept
- client (string): who it was for
- team (array|string): members (array recommended)
- contribution (string): your role/what you did
- importance (string): e.g., High, Medium, Low
- state (string): lifecycle (e.g., MVP, Prototype)
- features (array of strings): key features
- learnings (string): what you learned
- results (array of strings): outcomes/metrics
- tech: either
  - array of strings: ["Python", "FastAPI"]
  - or grouped object:
    {
      "languages": ["TypeScript", "Python"],
      "frameworks": ["React", "FastAPI"],
      "tools": ["Docker", "GitHub Actions"]
    }
- thumb (string): path to a thumbnail image
- images (array of strings): screenshots for the gallery
- visible (boolean): set to `false` to hide a project from the public site without deleting it (default: shown)
- order (number): manual ordering; lower numbers appear first. Projects without `order` fall back to sorting by `year` (newest first)
- links (object): any of
  - demo: URL to a live demo
  - portfolio: URL to a portfolio detail page
  - video: URL to a video
  - repo: URL to the source code

Tip: put images in the repository (e.g. `img/` folder) and reference with relative paths: `"img/my-project-1.png"`.

## Minimal example
```json
{
  "id": "my-project",
  "title": "My Project",
  "summary": "Short one-liner",
  "category": "software",
  "year": 2025
}
```

## Full example
```json
{
  "id": "my-project",
  "title": "My Project",
  "summary": "A modern app with great UX.",
  "category": "software",
  "year": 2025,
  "status": "Live",
  "client": "ACME Corp",
  "team": ["You", "Teammate"],
  "contribution": "Design & Development",
  "importance": "High",
  "state": "MVP",
  "features": [
    "Responsive UI",
    "Offline support"
  ],
  "learnings": "Optimized network layer and caching.",
  "results": [
    "Improved load time by 30%",
    "Raised conversion by 12%"
  ],
  "tech": {
    "languages": ["JavaScript"],
    "frameworks": ["React"],
    "tools": ["Vite", "GitHub Pages"]
  },
  "thumb": "img/my-project-thumb.png",
  "images": ["img/my-project-1.png", "img/my-project-2.png"],
  "links": {
    "demo": "https://example.com/demo",
    "portfolio": "https://example.com/details",
    "video": "https://example.com/video",
    "repo": "https://github.com/user/repo"
  }
}
```

## Notes
- All new fields are optional and the site hides any empty section.
- Tech can be an array or a grouped object. Grouped is clearer when you have many items.
- For best results, provide at least: id, title, category, and (optionally) year.

## Code projects (Programming page)

The Programming page reads from `data/code-projects.json`. Each project supports:
- id (string, required): unique slug
- title (string, required)
- description (string): short one-liner
- repo (string): URL to the source code
- demo (string): URL to a live demo (renders an embedded preview toggle)
- demoHeight (number): iframe height in px for the demo preview (default 400)

The public Programming page also lists all public GitHub repos automatically; `code-projects.json`
is for curated projects that have a live demo you want to embed.

## Skills (`data/skills.json`)

Skills are organized in groups. Each group's `items` array accepts either a plain string
or an object with a description and documentation links:

```json
{
  "name": "Python",
  "description": "What this skill is / how you use it.",
  "docs": [{ "label": "Official docs", "url": "https://docs.python.org/3/" }]
}
```

Plain strings still work (e.g. `"SQL"`); use the object form when you want a clickable
skill that expands to show its description and study/documentation links.

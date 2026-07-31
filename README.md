# jasgidp.github.io

Portafolio personal (sitio estático en GitHub Pages). El contenido vive en JSON
y se edita desde un panel admin privado.

## Estructura

```
/
├── index.html, about.html, portfolio.html, …   # páginas públicas (URLs estables)
├── admin/                 # panel de edición (privado)
│   ├── index.html
│   ├── admin.js / admin.css
│   └── github-api.js
├── css/main.css           # estilos del sitio
├── js/                    # scripts compartidos y por página
│   ├── header.js, i18n.js, script.js, analytics.js
│   └── projects.js, skills.js, timeline.js, …
├── data/                  # contenido editable (JSON)
├── locales/               # traducciones ES / EN / PT
├── assets/
│   ├── img/brand|profile|projects/
│   └── video/
└── docs/                  # CV y documentación
```

## Editar contenido

Abre **`/admin/`** (ej. https://jasgidp.github.io/admin/).

1. Token fine-grained de GitHub: repo `jasgidp/jasgidp.github.io`, permiso
   **Contents → Read and write**.
2. Entrar → editar → **Guardar en GitHub**.
3. GitHub Pages actualiza en ~1–2 min. Recarga fuerte (`Cmd+Shift+R`).

Imágenes de proyectos: se suben desde el admin a `assets/img/projects/`.

## Desarrollo local

```bash
python3 -m http.server 8000
```

Luego: http://localhost:8000

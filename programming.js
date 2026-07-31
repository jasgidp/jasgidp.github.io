/*
  ============================================================
  programming.js — Proyectos de código curados
  ------------------------------------------------------------
  ¿Qué hace?
  - Lee data/code-projects.json.
  - Dibuja cada proyecto en .programming-list (título, descripción,
    link al repo y, si hay demo, un botón + iframe oculto).
  - Filtra por el buscador #programming-search.

  El botón "Show demo" lo controla script.js (toggle del iframe).
  ============================================================
*/
(async () => {
  const list = document.querySelector('.programming-list');
  const search = document.getElementById('programming-search');
  // Si no estamos en programming.html, no hay nada que hacer
  if (!list) return;

  // Textos traducibles (con fallback en inglés)
  const repoLabel = () => (window.t ? window.t('programming.repo', 'Repo') : 'Repo');
  const previewLabel = () => (window.t ? window.t('programming.preview', 'Show demo') : 'Show demo');

  // Convierte un objeto proyecto en el HTML de una fila/tarjeta
  function itemHTML(p) {
    // Solo creamos botón + iframe si el proyecto tiene URL de demo
    const demo = p.demo ? `
      <button class="btn orange toggle-preview">
        <i class="ri-eye-line" aria-hidden="true"></i><span data-i18n="programming.preview">${previewLabel()}</span>
      </button>
      <iframe class="iframe" src="${p.demo}" width="100%" height="${p.demoHeight || 400}" loading="lazy"
              style="display:none; border:1px solid #e5e7eb; border-radius:12px;"></iframe>` : '';
    return `
      <li class="project-item" data-id="${p.id}">
        <h2>${p.title}</h2>
        <p class="description-project">${p.description || ''}</p>
        ${p.repo ? `<a class="btn" href="${p.repo}" target="_blank" rel="noopener">${repoLabel()}</a>` : ''}
        ${demo}
      </li>`;
  }

  // Muestra u oculta filas según lo escrito en el buscador
  function applySearch() {
    const q = (search?.value || '').toLowerCase();
    list.querySelectorAll('.project-item').forEach(it => {
      const title = it.querySelector('h2')?.textContent || '';
      const desc = it.querySelector('.description-project')?.textContent || '';
      it.style.display = `${title} ${desc}`.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  // Carga el JSON y pinta la lista
  try {
    const res = await fetch('./data/code-projects.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { projects } = await res.json();
    list.innerHTML = (projects || []).map(itemHTML).join('');
    // Aplicamos traducciones a los textos recién insertados
    if (window.applyI18n) window.applyI18n(list);
  } catch (err) {
    // fetch() falla si abres el HTML como file:// — hace falta un servidor HTTP
    console.warn('Failed to load code-projects.json; ensure the site is served over HTTP(s).', err);
    list.innerHTML = '<li class="project-item"><p>Unable to load projects.</p></li>';
  }

  // Cada tecla en el buscador vuelve a filtrar
  search?.addEventListener('input', applySearch);
})();

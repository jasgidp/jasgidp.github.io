/*
  ============================================================
  projects.js — Galería del Portafolio
  ------------------------------------------------------------
  ¿Qué hace?
  1) Carga data/projects.json.
  2) Dibuja tarjetas (tiles) en #projects-container.
  3) Filtra por categoría (botones .filters) y por buscador.
  4) Al hacer clic en una tarjeta, inserta debajo un panel
     con todos los detalles (descripción, tech, galería…).

  ¿Por qué?
  Separar datos (JSON) de la presentación (HTML generado)
  permite editar proyectos desde el panel admin sin tocar código.
  ============================================================
*/
(async () => {
  const container = document.getElementById('projects-container');
  // En portfolio.html el buscador se llama timeline-search (reutilizado)
  const searchInput = document.getElementById('projects-search') || document.getElementById('timeline-search');
  const softwareExtra = document.getElementById('software-extra');
  if (!container) return; // solo corre en portfolio.html

  try {
    const res = await fetch('./data/projects.json?t=' + Date.now(), { cache: 'no-store' });
    const { projects } = await res.json();

    // Estado de la UI: filtro activo + texto de búsqueda
    const state = { filter: 'all', q: '' };
    let openPanel = null;     // panel de detalles abierto ahora mismo
    let openProjectId = null; // id del proyecto abierto (para toggle)

    // Normaliza texto a minúsculas para buscar sin importar mayúsculas
    function normalize(s){ return (s||'').toString().toLowerCase(); }

    // Orden: primero por campo "order" (menor = primero);
    // si no hay order, ordena por año (más reciente primero).
    function sortProjects(arr){
      return arr.slice().sort((a,b)=>{
        const ao = Number.isFinite(a.order) ? a.order : Infinity;
        const bo = Number.isFinite(b.order) ? b.order : Infinity;
        if (ao !== bo) return ao - bo;
        return (b.year||0) - (a.year||0);
      });
    }

    // ¿Tiene el tag "nuevo"? (proyectos recién documentados desde Proyectos/)
    function isNew(p){
      return Array.isArray(p.tags) && p.tags.map(t => String(t).toLowerCase()).includes('nuevo');
    }

    // ¿Este proyecto debe mostrarse con el filtro/búsqueda actuales?
    function matches(p){
      if (p.visible === false) return false; // ocultos a propósito
      if (state.filter === 'nuevo') {
        if (!isNew(p)) return false;
      } else if (state.filter !== 'all' && p.category !== state.filter) {
        return false;
      }
      if (!state.q) return true;
      // Las tecnologías pueden ser un array o un objeto agrupado
      let techText = '';
      if (Array.isArray(p.tech)) techText = p.tech.join(' ');
      else if (p.tech && typeof p.tech === 'object') {
        const groups = [];
        if (Array.isArray(p.tech.languages)) groups.push(...p.tech.languages);
        if (Array.isArray(p.tech.frameworks)) groups.push(...p.tech.frameworks);
        if (Array.isArray(p.tech.tools)) groups.push(...p.tech.tools);
        techText = groups.join(' ');
      }
      const tagText = Array.isArray(p.tags) ? p.tags.join(' ') : '';
      const hay = [p.title, p.summary, p.category, techText, tagText, p.role, p.client, p.id].join(' ').toLowerCase();
      return hay.includes(state.q);
    }

    // Muestra el botón hacia programming.html solo si el filtro es "software"
    function toggleSoftwareExtra(){
      if (!softwareExtra) return;
      if (state.filter === 'software') softwareExtra.hidden = false; else softwareExtra.hidden = true;
    }

    // Dibuja (o re-dibuja) todas las tarjetas visibles
    function render(){
      const items = sortProjects(projects.filter(matches));
      if (!items.length) { container.innerHTML = '<p class="empty-state">No projects found.</p>'; toggleSoftwareExtra(); return; }

      container.innerHTML = items.map(p => {
        const raw = p.thumb || (Array.isArray(p.images) && p.images[0]) || '';
        // Si la imagen es el logo genérico, usamos un degradado CSS en su lugar
        const isPlaceholder = !raw || /(^|\/)HOme\.png$/i.test(raw) || /assets\/img\/brand\/HOme\.png$/i.test(raw);
        const bgStyle = isPlaceholder ? '' : ` style="background-image:url('${raw}')"`;
        const cls = isPlaceholder ? ' no-image' : '';
        const newBadge = isNew(p)
          ? `<span class="tile-badge-nuevo" data-i18n="filters.nuevo">Nuevo</span>`
          : '';
        return `
          <article class="project-card project-tile${cls}" data-category="${p.category}" data-id="${p.id}"${bgStyle} tabindex="0" aria-label="View ${p.title} details">
            ${newBadge}
            <div class="project-overlay">
              <h3 class="project-title">${p.title}</h3>
              ${p.year ? `<span class="project-year">${p.year}</span>` : ''}
            </div>
          </article>`;
      }).join('');

      // Al re-renderizar, cualquier panel abierto desaparece
      openPanel = null;
      openProjectId = null;
      toggleSoftwareExtra();
      if (window.applyI18n) window.applyI18n(document);
    }

    /* ------------------------------------------------------------
       PANEL DE DETALLES
       Se crea al hacer clic en una tarjeta e inserta debajo de ella.
       Contiene descripción, meta, tecnologías, features, galería…
       ------------------------------------------------------------ */
    function buildDetailsPanel(p){
      // Chips de tecnologías (soporta array plano o agrupado)
      const techChips = (() => {
        if (!p.tech) return '';
        const flat = Array.isArray(p.tech) ? p.tech : [
          ...(Array.isArray(p.tech.languages)? p.tech.languages : []),
          ...(Array.isArray(p.tech.frameworks)? p.tech.frameworks : []),
          ...(Array.isArray(p.tech.tools)? p.tech.tools : [])
        ];
        return flat.map(t => `<span class="chip">${t}</span>`).join('');
      })();

      const links = `
        ${p.links?.demo ? `<a href="${p.links.demo}" target="_blank" rel="noopener">Demo</a>` : ''}
        ${p.links?.portfolio ? `<a href="${p.links.portfolio}" target="_blank" rel="noopener">Portafolio</a>` : ''}
        ${p.links?.video ? `<a href="${p.links.video}" target="_blank" rel="noopener">Video</a>` : ''}
        ${p.links?.repo ? `<a href="${p.links.repo}" target="_blank" rel="noopener">Código</a>` : ''}
      `;

      const badges = `
        ${isNew(p) ? `<span class="badge badge--nuevo"><i class="ri-sparkling-line" aria-hidden="true"></i><span data-i18n="filters.nuevo">Nuevo</span></span>` : ''}
        ${p.category ? `<span class="badge"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${p.category}</span>` : ''}
        ${p.status ? `<span class="badge badge--status"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>${p.status}</span>` : ''}
        ${p.importance ? `<span class="badge badge--importance"><i class="ri-star-smile-line" aria-hidden="true"></i>${p.importance}</span>` : ''}
      `;

      const metaItems = [
        p.client ? `<div class="meta-item"><label>Cliente</label><div class="value">${p.client}</div></div>` : '',
        p.team ? `<div class="meta-item"><label>Integrantes</label><div class="value">${Array.isArray(p.team)? p.team.join(', ') : p.team}</div></div>` : '',
        p.contribution ? `<div class="meta-item"><label>Contribución</label><div class="value">${p.contribution}</div></div>` : '',
        p.state ? `<div class="meta-item"><label>Estado</label><div class="value">${p.state}</div></div>` : ''
      ].filter(Boolean).join('');

      const features = (p.features||[]).map(f => `<li>${f}</li>`).join('');
      const results = (p.results||[]).map(r => `<li>${r}</li>`).join('');
      const gallery = (Array.isArray(p.images)? p.images.slice(0,6) : []).map(src => `<img src="${src}" alt="${p.title} screenshot">`).join('');

      const panel = document.createElement('div');
      panel.className = 'project-details-panel';
      panel.setAttribute('role','region');
      panel.setAttribute('aria-label', `Detalles de ${p.title}`);
      if (p.category) panel.setAttribute('data-category', p.category);
      panel.innerHTML = `
        <div class="project-details-header">
          <div class="project-details-title">
            <h3>${p.title}</h3>
            ${p.year ? `<span class="year">${p.year}</span>` : ''}
          </div>
          <div class="project-badges">${badges}</div>
        </div>
        ${p.summary ? `<div class="section"><div class="section-header"><h4>Descripción</h4></div><p class="project-summary">${p.summary}</p></div>` : ''}
        <div class="project-sections">
          <div class="section">
            <div class="section-header"><h4>Detalles</h4></div>
            <div class="meta-grid">${metaItems}</div>
          </div>
          <div class="section">
            <div class="section-header"><h4>Tecnologías</h4></div>
            <div class="chips">${techChips}</div>
          </div>
          ${features ? `<div class="section"><div class="section-header"><h4>Características</h4></div><ul class="feature-list">${features}</ul></div>` : ''}
          ${p.learnings ? `<div class="section"><div class="section-header"><h4>Aprendizajes</h4></div><p>${p.learnings}</p></div>` : ''}
          ${results ? `<div class="section"><div class="section-header"><h4>Resultados</h4></div><ul class="result-list">${results}</ul></div>` : ''}
          ${gallery ? `<div class="section"><div class="section-header"><h4>Galería</h4></div><div class="gallery">${gallery}</div></div>` : ''}
          ${links.trim() ? `<div class="section"><div class="link-buttons">${links}</div></div>` : ''}
        </div>
      `;
      return panel;
    }

    // Clic en una tarjeta: abrir/cerrar su panel de detalles
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.project-tile');
      if (!card) return;
      const projectId = card.getAttribute('data-id');
      // Cerrar el panel anterior si había uno
      if (openPanel) {
        openPanel.remove();
        openPanel = null;
      }
      // Si clicaste la misma tarjeta otra vez → solo cerrar (toggle)
      if (openProjectId === projectId) {
        openProjectId = null;
        return;
      }
      const p = projects.find(pp => pp.id === projectId);
      if (!p) return;
      const panel = buildDetailsPanel(p);
      card.insertAdjacentElement('afterend', panel); // justo debajo de la tarjeta
      openPanel = panel;
      openProjectId = projectId;
      setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    });

    // Teclado: Enter o Espacio abren el panel (accesibilidad)
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.project-tile');
      if (!card) return;
      e.preventDefault();
      card.click();
    });

    // Clics en los botones de filtro
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.filters [data-filter]');
      if (!btn) return;
      document.querySelectorAll('.filters [data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      const filter = btn.getAttribute('data-filter');
      if (state.filter !== filter) { state.filter = filter; render(); }
    });

    // Cada tecla en el buscador re-filtra
    if (searchInput) searchInput.addEventListener('input', (e) => { state.q = normalize(e.target.value); render(); });

    render(); // primer dibujado
  } catch (err) {
    console.error('Failed to load projects', err);
    container.innerHTML = '<p style="padding:12px;">Projects could not load. Please serve the site with a local server or open the deployed GitHub Pages site.</p>';
  }
})();

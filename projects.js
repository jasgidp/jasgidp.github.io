(async () => {
  const container = document.getElementById('projects-container');
  const searchInput = document.getElementById('projects-search') || document.getElementById('timeline-search');
  const softwareExtra = document.getElementById('software-extra');
  if (!container) return;

  try {
    const res = await fetch('./data/projects.json');
    const { projects } = await res.json();

    const state = { filter: 'all', q: '' };
    let openPanel = null; // tracks the currently open details panel element
    let openProjectId = null;

    function normalize(s){ return (s||'').toString().toLowerCase(); }
    function sortByYear(arr){ return arr.slice().sort((a,b)=> (b.year||0) - (a.year||0)); }
    function matches(p){
      if (state.filter !== 'all' && p.category !== state.filter) return false;
      if (!state.q) return true;
      // Flatten tech whether it's an array or an object with groups
      let techText = '';
      if (Array.isArray(p.tech)) techText = p.tech.join(' ');
      else if (p.tech && typeof p.tech === 'object') {
        const groups = [];
        if (Array.isArray(p.tech.languages)) groups.push(...p.tech.languages);
        if (Array.isArray(p.tech.frameworks)) groups.push(...p.tech.frameworks);
        if (Array.isArray(p.tech.tools)) groups.push(...p.tech.tools);
        techText = groups.join(' ');
      }
      const hay = [p.title, p.summary, p.category, techText, p.role, p.client, p.id].join(' ').toLowerCase();
      return hay.includes(state.q);
    }

    function toggleSoftwareExtra(){
      if (!softwareExtra) return;
      if (state.filter === 'software') softwareExtra.hidden = false; else softwareExtra.hidden = true;
    }

    function render(){
      const items = sortByYear(projects.filter(matches));
      if (!items.length) { container.innerHTML = '<p class="empty-state">No projects found.</p>'; toggleSoftwareExtra(); return; }

      container.innerHTML = items.map(p => {
        const thumb = p.thumb || (Array.isArray(p.images) && p.images[0]) || '';
        const bgStyle = thumb ? ` style="background-image:url('${thumb}')"` : '';
        return `
          <article class="project-card project-tile" data-category="${p.category}" data-id="${p.id}"${bgStyle} tabindex="0" aria-label="View ${p.title} details">
            <div class="project-overlay">
              <h3 class="project-title">${p.title}</h3>
              ${p.year ? `<span class="project-year">${p.year}</span>` : ''}
            </div>
          </article>`;
      }).join('');

      // Reset any open panel after re-render
      openPanel = null;
      openProjectId = null;
      toggleSoftwareExtra();
      if (window.applyI18n) window.applyI18n(document);
    }

    // Build the full details panel for a project
    function buildDetailsPanel(p){
      // Tech: build chips from flat or grouped
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

    // Handle click on tiles to open/close the inline panel
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.project-tile');
      if (!card) return;
      const projectId = card.getAttribute('data-id');
      if (openPanel) {
        openPanel.remove();
        openPanel = null;
      }
      if (openProjectId === projectId) { // toggle off if same
        openProjectId = null;
        return;
      }
      const p = projects.find(pp => pp.id === projectId);
      if (!p) return;
      const panel = buildDetailsPanel(p);
      card.insertAdjacentElement('afterend', panel);
      openPanel = panel;
      openProjectId = projectId;
      // Optional: ensure the panel is in view
      setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    });

    // Keyboard accessibility: open on Enter/Space
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.project-tile');
      if (!card) return;
      e.preventDefault();
      card.click();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.filters [data-filter]');
      if (!btn) return;
      document.querySelectorAll('.filters [data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      // update state and re-render
      const filter = btn.getAttribute('data-filter');
      if (state.filter !== filter) { state.filter = filter; render(); }
    });

    if (searchInput) searchInput.addEventListener('input', (e) => { state.q = normalize(e.target.value); render(); });

    render();
  } catch (err) {
    console.error('Failed to load projects', err);
    container.innerHTML = '<p style="padding:12px;">Projects could not load. Please serve the site with a local server or open the deployed GitHub Pages site.</p>';
  }
})();

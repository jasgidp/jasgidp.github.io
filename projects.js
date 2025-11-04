(async () => {
  const container = document.getElementById('projects-container');
  const searchInput = document.getElementById('projects-search');
  const softwareExtra = document.getElementById('software-extra');
  if (!container) return;

  try {
    const res = await fetch('./data/projects.json');
    const { projects } = await res.json();

    const state = { filter: 'all', q: '' };

    function normalize(s){ return (s||'').toString().toLowerCase(); }
    function sortByYear(arr){ return arr.slice().sort((a,b)=> (b.year||0) - (a.year||0)); }
    function matches(p){
      if (state.filter !== 'all' && p.category !== state.filter) return false;
      if (!state.q) return true;
      const hay = [p.title, p.summary, p.category, (p.tech||[]).join(' '), p.role, p.id].join(' ').toLowerCase();
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
        const tags = (p.tech||[]).map(t => `<span class="tag">${t}</span>`).join('');
        const links = `
          ${p.links?.demo ? `<a href="${p.links.demo}" target="_blank" rel="noopener" class="btn">Demo</a>` : ''}
          ${p.links?.video ? `<a href="${p.links.video}" target="_blank" rel="noopener" class="btn ghost">Video</a>` : ''}
          ${p.links?.repo ? `<a href="${p.links.repo}" target="_blank" rel="noopener" class="btn ghost">Repo</a>` : ''}
        `;
        return `
          <article class="skill-card project-card" data-category="${p.category}">
            <h3 class="project-title" data-project="${p.id}">
              ${p.title} ${p.year ? `<span class="project-year" style="font-weight:400;color:#64748b;">· ${p.year}</span>` : ''}
            </h3>
            <div class="project-details" hidden>
              <p class="project-summary">${p.summary || ''}</p>
              ${tags ? `<div class="skill-tags">${tags}</div>` : ''}
              ${links ? `<div class="actions">${links}</div>` : ''}
            </div>
          </article>`;
      }).join('');
      toggleSoftwareExtra();
      // Re-apply i18n to any dynamic content
      if (window.applyI18n) window.applyI18n(document);
    }

    // Toggle details on title click
    container.addEventListener('click', (e) => {
      const title = e.target.closest('.project-title');
      if (!title) return;
      const card = title.closest('.project-card');
      const details = card.querySelector('.project-details');
      const isHidden = details.hasAttribute('hidden');
      if (isHidden) {
        details.removeAttribute('hidden');
        details.style.maxHeight = details.scrollHeight + 'px';
      } else {
        details.style.maxHeight = details.scrollHeight + 'px';
        requestAnimationFrame(() => { details.style.maxHeight = '0px'; });
        details.addEventListener('transitionend', () => details.setAttribute('hidden',''), { once:true });
      }
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

/*
  ============================================================
  skills.js — Página de Habilidades
  ------------------------------------------------------------
  ¿Qué hace?
  - Carga data/skills.json (grupos con lista de skills).
  - Genera chips de filtro por grupo.
  - Dibuja tarjetas; al clic en una skill con detalle,
    despliega descripción y enlaces de documentación.

  Formato de cada skill en el JSON:
    "Python"  → solo nombre
    ó { "name": "Python", "description": "...", "docs": [{label, url}] }
  ============================================================
*/
(async () => {
  const container = document.getElementById('skills-container');
  const chips = document.getElementById('group-chips');
  const search = document.getElementById('skill-search');
  if (!container) return;

  // Elige el texto del label según el idioma de <html lang="...">
  function t(labelObj, fallback) {
    const lang = document.documentElement.lang || 'en';
    return (labelObj && (labelObj[lang] || labelObj['en'])) || fallback || '';
  }

  // Acepta strings antiguos y el formato nuevo con objetos
  function normalizeSkill(item) {
    if (typeof item === 'string') return { name: item, description: '', docs: [] };
    return {
      name: item.name || '',
      description: item.description || '',
      docs: Array.isArray(item.docs) ? item.docs : []
    };
  }

  let groups = [];
  let state = { group: 'all', query: '' };
  let openKey = null; // skill expandida: "grupo::nombre"

  // Dibuja los botones de filtro (All + un chip por grupo)
  function renderChips() {
    const list = [{ key: 'all', label: '✨ All' }, ...groups.map(g => ({ key: g.name, label: `${g.emoji ? g.emoji + ' ' : ''}${t(g.label, g.name)}` }))];
    chips.innerHTML = list.map(({ key, label }) => `<button class="chip${state.group === key ? ' active' : ''}" data-group="${key}">${label}</button>`).join('');
  }

  function skillHasDetail(s) {
    return !!(s.description || (s.docs && s.docs.length));
  }

  // HTML del panel expandido (descripción + docs)
  function renderDetail(s) {
    if (!skillHasDetail(s)) return '';
    const docs = (s.docs || []).map(d =>
      `<a href="${d.url}" target="_blank" rel="noopener" class="skill-doc"><i class="ri-links-line" aria-hidden="true"></i>${d.label || d.url}</a>`
    ).join('');
    return `
      <div class="skill-detail">
        ${s.description ? `<p class="skill-desc">${s.description}</p>` : ''}
        ${docs ? `<div class="skill-docs">${docs}</div>` : ''}
      </div>`;
  }

  // Dibuja la rejilla de tarjetas filtradas
  function renderGrid() {
    const filtered = groups
      .filter(g => state.group === 'all' || g.name === state.group)
      .map(g => ({
        ...g,
        skills: (g.items || []).map(normalizeSkill).filter(s => s.name.toLowerCase().includes(state.query))
      }))
      .filter(g => g.skills.length > 0);

    container.innerHTML = filtered.map(g => `
      <article class="skill-card">
        <h3>${g.emoji ? g.emoji + ' ' : ''}${t(g.label, g.name)}</h3>
        <ul class="skill-tags">
          ${g.skills.map(s => {
            const key = `${g.name}::${s.name}`;
            const hasDetail = skillHasDetail(s);
            const expanded = openKey === key;
            return `<li class="tag${hasDetail ? ' has-detail' : ''}${expanded ? ' open' : ''}"
                        ${hasDetail ? `role="button" tabindex="0" aria-expanded="${expanded}" data-skill-key="${key}"` : ''}>
                      ${s.name}${hasDetail ? '<i class="ri-arrow-down-s-line skill-caret" aria-hidden="true"></i>' : ''}
                      ${expanded ? renderDetail(s) : ''}
                    </li>`;
          }).join('')}
        </ul>
      </article>
    `).join('') || '<p style="text-align:center;">No skills found.</p>';
  }

  // Busca una skill por su clave "grupo::nombre"
  function findSkill(key) {
    for (const g of groups) {
      for (const raw of (g.items || [])) {
        const s = normalizeSkill(raw);
        if (`${g.name}::${s.name}` === key) return s;
      }
    }
    return null;
  }

  // Carga inicial
  try {
    const res = await fetch('./data/skills.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    groups = data.groups || [];
    renderChips();
    renderGrid();
  } catch (err) {
    console.warn('Failed to load skills.json; ensure the site is served over HTTP(s).', err);
    container.innerHTML = '<p style="text-align:center;">Unable to load skills.</p>';
  }

  // Clic en un chip de grupo → filtrar
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.group-chips .chip');
    if (!btn) return;
    state.group = btn.getAttribute('data-group');
    openKey = null;
    renderChips();
    renderGrid();
  });

  // Expandir / contraer detalle de una skill
  function toggleSkill(li) {
    const key = li.getAttribute('data-skill-key');
    if (!key || !findSkill(key)) return;
    openKey = (openKey === key) ? null : key;
    renderGrid();
  }
  container.addEventListener('click', (e) => {
    const li = e.target.closest('.tag.has-detail');
    if (li) toggleSkill(li);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.tag.has-detail');
    if (li) { e.preventDefault(); toggleSkill(li); }
  });

  // Buscador en vivo
  search?.addEventListener('input', (e) => {
    state.query = (e.target.value || '').trim().toLowerCase();
    openKey = null;
    renderGrid();
  });
})();

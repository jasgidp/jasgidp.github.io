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

  // Resuelve un campo que puede venir como texto plano o como {es,en,pt}.
  // Así conviven las habilidades traducidas con las que aún no lo están.
  function tx(value, fallback) {
    if (value == null) return fallback || '';
    if (typeof value === 'string') return value;
    return t(value, fallback);
  }

  // Acepta strings antiguos y el formato nuevo con objetos
  function normalizeSkill(item) {
    if (typeof item === 'string') return { name: item, description: '', docs: [], projects: [] };
    return {
      name: tx(item.name, ''),
      description: tx(item.description, ''),
      docs: (Array.isArray(item.docs) ? item.docs : []).map(d => ({
        url: d.url,
        label: tx(d.label, d.url)
      })),
      // Proyectos de data/projects.json donde se usó esta habilidad
      projects: Array.isArray(item.projects) ? item.projects : [],
      // Clase de Remix Icon que se pinta dentro del chip
      icon: item.icon || '',
      // Solo los idiomas traen estos tres: pintan bandera y barra de dominio
      flag: item.flag || '',
      level: typeof item.level === 'number' ? item.level : null,
      levelLabel: tx(item.levelLabel, '')
    };
  }

  // id de proyecto -> título, para mostrar nombres legibles en los chips.
  // Se llena desde data/projects.json; si no carga, usamos el id tal cual.
  let projectTitles = {};

  // Escapa texto que se inserta en atributos HTML
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Chips de proyectos donde se usó la habilidad. Cada uno abre el
  // proyecto en portfolio.html mediante ?p=<id> (lo lee projects.js).
  function renderProjects(s) {
    if (!s.projects || !s.projects.length) return '';
    const chips = s.projects.map(id => {
      const title = projectTitles[id] || id;
      return `<a class="skill-project" href="portfolio.html?p=${encodeURIComponent(id)}"><i class="ri-folder-3-line" aria-hidden="true"></i>${esc(title)}</a>`;
    }).join('');
    return `<div class="skill-projects-wrap">
        <span class="skill-projects-label" data-i18n="skills.usedIn">Used in</span>
        <div class="skill-projects">${chips}</div>
      </div>`;
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
    return !!(s.description || (s.docs && s.docs.length) || (s.projects && s.projects.length) || s.level !== null);
  }

  /* NIVEL EN PUNTOS
     El nivel se guarda de 0 a 100 (es lo que se edita en el admin) pero
     se muestra como 5 puntos. Un "65 %" aparenta una precisión que no
     existe: son estimaciones, no medidas. Tres de cinco es honesto.  */
  const DOTS = 5;
  function dotsFor(level) {
    return Math.max(1, Math.min(DOTS, Math.round(level / (100 / DOTS))));
  }
  // Tramo con nombre, para el texto accesible y el detalle
  function tierKey(n) {
    return n >= 5 ? 'expert' : n === 4 ? 'advanced' : n === 3 ? 'intermediate' : 'basic';
  }
  function tierLabel(n) {
    const fb = { expert: 'Experto', advanced: 'Avanzado', intermediate: 'Intermedio', basic: 'Básico' };
    const k = tierKey(n);
    return (window.t ? window.t('skills.levels.' + k, fb[k]) : fb[k]);
  }
  /* Los puntos son una imagen: se anuncian con su texto equivalente
     ("Nivel: Avanzado, 4 de 5"), así el color no es el único portador. */
  function renderDots(level, cls) {
    if (level === null) return '';
    const n = dotsFor(level);
    const label = `${(window.t ? window.t('skills.level', 'Nivel') : 'Nivel')}: ${tierLabel(n)}, ${n}/${DOTS}`;
    const dots = Array.from({ length: DOTS }, (_, i) =>
      `<span class="skill-dot${i < n ? ' on' : ''}"></span>`).join('');
    return `<span class="skill-dots ${cls || ''}" role="img" aria-label="${esc(label)}">${dots}</span>`;
  }

  /* Barra de nivel para el detalle expandido. El chip ya insinúa el
     nivel con su relleno; aquí se ve la cifra exacta. El porcentaje va
     también en texto, así que no depende solo del color. */
  function renderLevelBar(s) {
    if (s.level === null) return '';
    const n = dotsFor(s.level);
    return `
      <div class="skill-level">
        <span class="skill-level-label" data-i18n="skills.level">Nivel</span>
        ${renderDots(s.level, 'big')}
        <span class="skill-level-tier">${tierLabel(n)}</span>
      </div>`;
  }

  // HTML del panel expandido (descripción + docs)
  function renderDetail(s) {
    if (!skillHasDetail(s)) return '';
    const docs = (s.docs || []).map(d =>
      `<a href="${d.url}" target="_blank" rel="noopener" class="skill-doc"><i class="ri-links-line" aria-hidden="true"></i>${d.label || d.url}</a>`
    ).join('');
    return `
      <div class="skill-detail">
        ${renderLevelBar(s)}
        ${s.description ? `<p class="skill-desc">${s.description}</p>` : ''}
        ${docs ? `<div class="skill-docs">${docs}</div>` : ''}
        ${renderProjects(s)}
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

    container.innerHTML = filtered.map(g => {
      /* Los idiomas se pintan como lista de barras con bandera; el resto,
         como chips. Antes esto se decidía por "tiene level", pero ahora
         todas las habilidades lo tienen, así que se distingue por la
         bandera, que solo llevan los idiomas. */
      const isLevelGroup = g.skills.some(s => s.flag);
      const body = isLevelGroup ? renderLevelList(g.skills) : renderTagList(g);
      return `
      <article class="skill-card">
        <h3>${g.emoji ? g.emoji + ' ' : ''}${t(g.label, g.name)}</h3>
        ${body}
      </article>`;
    }).join('') || '<p style="text-align:center;">No skills found.</p>';

    // Los textos con data-i18n recién insertados (p. ej. "Usado en")
    // necesitan traducirse; renderGrid corre después de i18n.js.
    if (window.applyI18n) window.applyI18n(container);
  }

  // Lista normal de chips desplegables
  function renderTagList(g) {
    return `<ul class="skill-tags">
          ${g.skills.map(s => {
            const key = `${g.name}::${s.name}`;
            const hasDetail = skillHasDetail(s);
            const expanded = openKey === key;
            const icon = s.icon ? `<i class="${s.icon} skill-icon" aria-hidden="true"></i>` : '';
            const dots = renderDots(s.level);
            const title = s.level === null ? '' : ` title="${esc(s.name)} — ${tierLabel(dotsFor(s.level))}"`;
            return `<li class="tag${hasDetail ? ' has-detail' : ''}${expanded ? ' open' : ''}"${title}
                        ${hasDetail ? `role="button" tabindex="0" aria-expanded="${expanded}" data-skill-key="${key}"` : ''}>
                      ${icon}<span class="skill-name">${esc(s.name)}</span>${dots}${hasDetail ? '<i class="ri-arrow-down-s-line skill-caret" aria-hidden="true"></i>' : ''}
                      ${expanded ? renderDetail(s) : ''}
                    </li>`;
          }).join('')}
        </ul>`;
  }

  // Idiomas: bandera, nombre, nivel MCER y barra de porcentaje.
  // La barra es decorativa (aria-hidden); el porcentaje ya va en texto,
  // asi que un lector de pantalla no pierde informacion.
  function renderLevelList(skills) {
    return `<ul class="lang-list">
      ${skills.map(s => {
        const pct = Math.max(0, Math.min(100, s.level ?? 0));
        return `<li class="lang-item">
          <div class="lang-head">
            <span class="lang-flag" aria-hidden="true">${s.flag}</span>
            <span class="lang-name">${esc(s.name)}</span>
            ${s.levelLabel ? `<span class="lang-level">${esc(s.levelLabel)}</span>` : ''}
            <span class="lang-pct">${pct}%</span>
          </div>
          <div class="lang-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          ${s.description ? `<p class="lang-desc">${esc(s.description)}</p>` : ''}
        </li>`;
      }).join('')}
    </ul>`;
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
    const res = await fetch('./data/skills.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    groups = data.groups || [];

    // Títulos de proyecto para los chips "Used in". Es opcional: si falla,
    // los chips muestran el id y la página sigue funcionando igual.
    try {
      const pr = await fetch('./data/projects.json?t=' + Date.now(), { cache: 'no-store' });
      if (pr.ok) {
        const pj = await pr.json();
        (pj.projects || []).forEach(p => { projectTitles[p.id] = p.title || p.id; });
      }
    } catch (e) { /* sin títulos: se usan los ids */ }

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

  // Al cambiar de idioma hay que re-dibujar: los títulos de grupo salen
  // de label{es,en,pt} y las barras de idioma llevan texto traducible.
  document.addEventListener('i18n:updated', () => {
    if (!groups.length) return;
    renderChips();
    renderGrid();
  });

  // Buscador en vivo
  search?.addEventListener('input', (e) => {
    state.query = (e.target.value || '').trim().toLowerCase();
    openKey = null;
    renderGrid();
  });
})();

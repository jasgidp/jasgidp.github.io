/*
  ============================================================
  timeline.js — Página de Trayectoria / Cronología
  ------------------------------------------------------------
  ¿Qué hace?
  - Carga data/timeline.json (experience, research, leadership, education).
  - Crea pestañas solo para las secciones que tengan datos.
  - Dibuja tarjetas ordenadas por fecha (más reciente primero).
  - Filtra con el buscador.
  - Anima la aparición de cada tarjeta con IntersectionObserver
    (cuando entran en pantalla, reciben la clase "visible").
  ============================================================
*/
(async () => {
  const container = document.getElementById('timeline-container');
  const tabsNav = document.getElementById('timeline-tabs');
  const searchInput = document.getElementById('timeline-search');
  if (!container) return;

  // Definición de secciones: key = id interno, dataKey = campo en el JSON, icon = Remix Icon
  const SECTIONS = [
    { key: 'work', dataKey: 'experience', icon: 'ri-briefcase-line' },
    { key: 'research', dataKey: 'research', icon: 'ri-flask-line' },
    { key: 'leadership', dataKey: 'leadership', icon: 'ri-group-line' },
    { key: 'education', dataKey: 'education', icon: 'ri-graduation-cap-line' }
  ];

  let data = { experience: [], research: [], leadership: [], education: [] };
  let activeSection = 'work';
  let searchTerm = '';

  // Observador: cuando un .reveal entra en pantalla, le pone .visible (animación CSS)
  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
      }, { threshold: 0.1 })
    : null;

  // Construye las pestañas (oculta secciones vacías)
  function buildTabs() {
    if (!tabsNav) return;
    tabsNav.innerHTML = '';
    SECTIONS.forEach(sec => {
      const items = data[sec.dataKey] || [];
      if (!items.length) return;
      const btn = document.createElement('button');
      btn.className = 'tab' + (activeSection === sec.key ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', activeSection === sec.key ? 'true' : 'false');
      btn.dataset.section = sec.key;
      btn.setAttribute('data-i18n', `timeline.${sec.key}`);
      btn.textContent = sec.key; // i18n.js reemplazará este texto
      tabsNav.appendChild(btn);
    });
    if (window.applyI18n) window.applyI18n(tabsNav);
  }

  // Convierte "2023-01" en un objeto Date para poder ordenar
  function parseDate(d){ if(!d) return null; const [y,m] = String(d).split('-'); const Y=+y||0; const M=(+m||1)-1; return new Date(Y,M,1); }

  // ¿La entrada coincide con el texto del buscador?
  function matchSearch(it, q){ if(!q) return true; const hay=[it.role,it.org,it.start,it.end,...(it.bullets||[])].filter(Boolean).join(' \n ').toLowerCase(); return hay.includes(q.toLowerCase()); }

  // Dibuja la sección activa
  function renderSection(sectionKey) {
    const meta = SECTIONS.find(s => s.key === sectionKey) || SECTIONS[0];
    let items = (data[meta.dataKey] || []).filter(it => matchSearch(it, searchTerm));
    // Orden descendente por fecha de inicio
    items = items.slice().sort((a,b)=>{ const da=parseDate(a.start); const db=parseDate(b.start); if(!da&&!db) return 0; if(!da) return 1; if(!db) return -1; return db-da; });

    if (!items.length) {
      container.innerHTML = '<p style="text-align:center; color:#64748b; margin: 12px 0;">No items match your search.</p>';
      return;
    }

    const present = (window.t ? window.t('timeline.present', 'Present') : 'Present');
    const html = `
      <section class="timeline-section">
        <h2 class="visually-hidden" data-i18n="timeline.${sectionKey}">${sectionKey}</h2>
        <ul class="timeline-list">
          ${items.map(it => {
            const end = it.end && it.end.trim() ? it.end : present;
            const bullets = (it.bullets || []).map(b => `<li>${b}</li>`).join('');
            return `
              <li class="timeline-item reveal">
                <div class="timeline-card">
                  <div class="timeline-header">
                    <div class="title-wrap">
                      <i class="timeline-icon ${meta.icon}" aria-hidden="true"></i>
                      <h3>${it.role} — <span class="org">${it.org}</span></h3>
                    </div>
                    <span class="dates">${it.start} – ${end}</span>
                  </div>
                  <ul class="bullets">${bullets}</ul>
                </div>
              </li>`;
          }).join('')}
        </ul>
      </section>`;

    container.innerHTML = html;

    // Activar animación de revelado
    if (io) {
      container.querySelectorAll('.reveal').forEach(el => io.observe(el));
    } else {
      container.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }
  }

  // Cambia de pestaña y re-dibuja
  function setActive(sectionKey){
    activeSection = sectionKey;
    if (tabsNav) {
      tabsNav.querySelectorAll('.tab').forEach(btn => {
        const isActive = btn.dataset.section === activeSection;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }
    renderSection(activeSection);
  }

  // Enlaza eventos de pestañas, buscador e idioma
  function attachEvents(){
    if (tabsNav) {
      tabsNav.addEventListener('click', (e)=>{
        const btn=e.target.closest('.tab');
        if(!btn) return;
        e.preventDefault();
        const key=btn.dataset.section;
        if(key && key!==activeSection) setActive(key);
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (e)=>{
        searchTerm = e.target.value||'';
        renderSection(activeSection);
      });
    }
    document.addEventListener('i18n:updated', ()=>{ buildTabs(); renderSection(activeSection); });
  }

  // Arranque de la UI: elige la primera sección con datos
  function initUI(){
    const available = SECTIONS.find(s => (data[s.dataKey]||[]).length>0);
    activeSection = available ? available.key : 'work';
    buildTabs();
    setActive(activeSection);
    attachEvents();
  }

  try {
    const res = await fetch('./data/timeline.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    data = { ...data, ...json };
    initUI();
  } catch (err) {
    console.warn('Failed to load timeline.json; using fallback. Tip: run via a local server or GitHub Pages.', err);
    data = { experience: [], research: [], leadership: [], education: [] };
    initUI();
    container.insertAdjacentHTML('afterbegin', '<p style="margin:8px 0; text-align:center;">No timeline data available. Ensure the site is served over HTTP(s).</p>');
  }
})();

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
    /* "all" no tiene dataKey propio: junta las cuatro secciones en un
       mapa temporal. Va primero porque es la vista panorámica; las
       pestañas siguientes siguen siendo el detalle en tarjetas. */
    { key: 'all', dataKey: null, icon: 'ri-calendar-2-line' },
    { key: 'work', dataKey: 'experience', icon: 'ri-briefcase-line' },
    { key: 'research', dataKey: 'research', icon: 'ri-flask-line' },
    { key: 'leadership', dataKey: 'leadership', icon: 'ri-group-line' },
    { key: 'education', dataKey: 'education', icon: 'ri-graduation-cap-line' }
  ];

  let data = { experience: [], research: [], leadership: [], education: [] };
  let activeSection = 'all';
  // Rango visible del mapa temporal. null = todo. Se fija al pulsar una barra.
  let zoom = null;
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
      const items = sec.dataKey ? (data[sec.dataKey] || []) : allEntries();
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

  /* Resuelve un texto que puede venir plano o como {es,en,pt}.
     Igual que en projects.js y skills.js: los datos ya traducidos y los
     que aún no lo están conviven sin romper nada. */
  function tx(value, fallback){
    if (value == null) return fallback || '';
    if (typeof value === 'string') return value;
    const l = document.documentElement.lang || 'es';
    return value[l] || value.en || value.es || fallback || '';
  }

  // Escapa texto que se inserta en un atributo HTML
  function esc(str){
    return String(str == null ? '' : str)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Convierte "2023-01" en un objeto Date para poder ordenar
  function parseDate(d){ if(!d) return null; const [y,m] = String(d).split('-'); const Y=+y||0; const M=(+m||1)-1; return new Date(Y,M,1); }

  /* ------------------------------------------------------------
     FECHAS LEGIBLES Y DURACIÓN
     El JSON guarda "2023-10" porque es fácil de ordenar, pero eso
     se lee mal. Aquí lo pasamos a "oct 2023" en el idioma activo y
     calculamos cuánto duró, que es lo que de verdad se quiere saber
     de un vistazo.
     ------------------------------------------------------------ */

  // Palabras de duración por idioma (singular / plural)
  const DUR = {
    es: { y:['año','años'],  m:['mes','meses'] },
    en: { y:['yr','yrs'],    m:['mo','mos']    },
    pt: { y:['ano','anos'],  m:['mês','meses'] }
  };
  function lang(){ const l = document.documentElement.lang || 'es'; return DUR[l] ? l : 'es'; }

  // "2023-10" -> "oct 2023". Si solo hay año ("2023"), se deja el año.
  function formatDate(d){
    if (!d) return '';
    const str = String(d);
    if (!str.includes('-')) return str; // solo año
    const dt = parseDate(str);
    if (!dt || isNaN(dt)) return str;
    try {
      return new Intl.DateTimeFormat(lang(), { month:'short', year:'numeric' }).format(dt);
    } catch (e) { return str; }
  }

  // Meses completos entre dos fechas (el mes de inicio cuenta)
  function monthsBetween(a, b){
    return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) + 1;
  }

  // "1 año 2 meses". Devuelve '' si no se puede calcular.
  function formatDuration(start, end){
    const a = parseDate(start);
    if (!a || isNaN(a)) return '';
    const b = end ? parseDate(end) : new Date();
    if (!b || isNaN(b) || b < a) return '';
    const total = monthsBetween(a, b);
    if (total < 1) return '';
    const years = Math.floor(total/12), months = total%12;
    const w = DUR[lang()];
    const parts = [];
    if (years)  parts.push(`${years} ${w.y[years===1?0:1]}`);
    if (months) parts.push(`${months} ${w.m[months===1?0:1]}`);
    return parts.join(' ');
  }

  // ¿La entrada coincide con el texto del buscador?
  function matchSearch(it, q){ if(!q) return true; const hay=[tx(it.role),tx(it.org),it.start,it.end,tx(it.location),tx(it.employment),...(it.skills||[]),...((it.bullets||[]).map(b=>tx(b)))].filter(Boolean).join(' \n ').toLowerCase(); return hay.includes(q.toLowerCase()); }

  /* ============================================================
     VISTA "TODO" — mapa temporal
     ------------------------------------------------------------
     Las pestañas por sección cuentan cada hilo por separado, pero
     esconden lo que más dice de la trayectoria: que muchas cosas
     pasaron A LA VEZ (trabajar en Genius mientras se era monitor de
     investigación, dirigir AIESEC y estudiar, la maestría encima del
     trabajo). Aquí cada entrada es una barra sobre un eje de años
     común, así que los solapamientos se ven solos: basta con mirar
     una columna vertical para saber qué había en marcha ese año.

     Las filas van ordenadas por fecha de inicio, no agrupadas por
     sección: agrupando, dos cosas simultáneas de secciones distintas
     quedan lejos en vertical y el solapamiento deja de leerse. El
     color lleva la sección, con su leyenda.
     ============================================================ */

  /* Bandera solo de las etapas FUERA de Colombia, que es lo que hay que
     señalar. Emoji y no imagen: no hay que cargar nada, escala con el
     texto y funciona en cualquier sistema. El código ISO se convierte
     en emoji sumando el desplazamiento de las letras regionales. */
  const PAIS = { BR: 'Brasil', MX: 'México', CO: 'Colombia', US: 'Estados Unidos', PT: 'Portugal', ES: 'España' };
  function flagOf(code){
    if (!code || code.length !== 2) return '';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }

  // Todas las entradas de las cuatro secciones, con su sección marcada
  function allEntries(){
    const out = [];
    SECTIONS.forEach(sec => {
      if (!sec.dataKey) return;
      (data[sec.dataKey] || []).forEach(it => out.push({ ...it, _section: sec.key, _icon: sec.icon }));
    });
    return out;
  }

  // Fecha -> número de meses desde el año 0, para calcular proporciones
  function toMonths(d){
    const dt = parseDate(d);
    return dt && !isNaN(dt) ? dt.getFullYear() * 12 + dt.getMonth() : null;
  }

  function renderMap(){
    const todas = allEntries().filter(it => matchSearch(it, searchTerm));
    if (!todas.length) {
      container.innerHTML = `<p class="tl-empty">${(window.t ? window.t('timeline.noResults', 'No items match your search.') : 'No items match your search.')}</p>`;
      return;
    }

    const now = new Date();
    const nowM = now.getFullYear() * 12 + now.getMonth();
    const fin_ = it => (it.end ? toMonths(it.end) : nowM);

    /* ZOOM
       Con 14 años en pantalla, las etapas de tres meses de 2018-2019 se
       amontonan en cuatro píxeles y no hay quien las lea. Al pulsar una
       barra el eje se recorta a ese periodo con un año de margen, y
       entonces las cortas se separan. Las etapas que no tocan el rango
       se quedan fuera: menos filas y más aire. */
    let items = todas;
    if (zoom) {
      items = todas.filter(it => toMonths(it.start) <= zoom.to && fin_(it) >= zoom.from);
    }

    const starts = items.map(it => toMonths(it.start)).filter(v => v !== null);
    if (!starts.length) { container.innerHTML = '<p class="tl-empty">—</p>'; return; }
    const ends = items.map(fin_).filter(v => v !== null);

    /* Rango del eje: de enero del año más antiguo a diciembre del más
       reciente, así los extremos caen en un límite de año y las marcas
       del eje cuadran con las barras. */
    const minY = Math.floor((zoom ? zoom.from : Math.min(...starts)) / 12);
    const maxY = Math.floor((zoom ? zoom.to : Math.max(...ends, nowM)) / 12);
    const from = minY * 12, to = (maxY + 1) * 12;
    const span = to - from;
    const pct = m => ((m - from) / span) * 100;

    items = items.slice().sort((a, b) => (toMonths(a.start) ?? 0) - (toMonths(b.start) ?? 0));

    const present = (window.t ? window.t('timeline.present', 'Present') : 'Present');
    const T = (k, fb) => (window.t ? window.t('timeline.' + k, fb) : fb);

    const years = [];
    for (let y = minY; y <= maxY; y++) years.push(y);
    // Con pocos años caben los cuatro dígitos; con muchos, solo dos
    const corto = years.length > 8;
    const axis = years.map(y =>
      `<span class="tl-tick" style="left:${pct(y * 12)}%"><b>${corto ? String(y).slice(2) : y}</b></span>`).join('');
    const grid = years.map(y =>
      `<span class="tl-grid-line" style="left:${pct(y * 12)}%"></span>`).join('');

    const legend = SECTIONS.filter(sec => sec.dataKey && (data[sec.dataKey] || []).length)
      .map(sec => `<span class="tl-legend-item" data-section="${sec.key}">
          <span class="tl-legend-dot"></span><span data-i18n="timeline.${sec.key}">${sec.key}</span>
        </span>`).join('');

    const rows = items.map((it, i) => {
      const a = toMonths(it.start);
      const bRaw = fin_(it);
      const ongoing = !it.end;
      // Una barra de un solo mes sería invisible: se le da un mínimo
      const b = Math.max((bRaw ?? a) + 1, (a ?? 0) + 2);
      const left = Math.max(0, pct(a));
      const width = Math.max(Math.min(pct(b), 100) - left, 1.2);
      const endTxt = ongoing ? present : formatDate(it.end);
      const dur = formatDuration(it.start, it.end);
      const label = `${formatDate(it.start)} – ${endTxt}${dur ? ` · ${dur}` : ''}`;
      const bandera = flagOf(it.country);

      /* La fecha va SIEMPRE al lado de la barra, nunca dentro: dentro
         solo cabía en las barras más largas y mezclar texto blanco
         dentro con gris fuera hacía saltar la vista de fila en fila. */
      const atEnd = left + width > 72;
      const outside = atEnd
        ? `<span class="tl-bar-out end" style="right:${(100 - left).toFixed(3)}%">${label}</span>`
        : `<span class="tl-bar-out" style="left:${(left + width).toFixed(3)}%">${label}</span>`;

      const bullets = (it.bullets || []).slice(0, 4).map(x => `<li>${tx(x)}</li>`).join('');
      const skills = (it.skills || []).map(sk => `<span class="tl-pop-skill">${sk}</span>`).join('');
      const metaLine = [tx(it.employment), tx(it.location)].filter(Boolean).join(' · ');

      return `
        <div class="tl-row" data-section="${it._section}" data-i="${i}"
             tabindex="0" role="button"
             data-from="${a}" data-to="${bRaw}">
          <div class="tl-row-label">
            <i class="${it._icon}" aria-hidden="true"></i>
            <span class="tl-row-role">${tx(it.role)}</span>
            ${bandera ? `<span class="tl-flag" title="${esc(PAIS[it.country] || it.country)}">${bandera}</span>` : ''}
            <span class="tl-row-org">${tx(it.org)}</span>
          </div>
          <div class="tl-track">
            <div class="tl-bar${ongoing ? ' ongoing' : ''}" style="left:${left}%; width:${width}%"></div>
            ${outside}
          </div>

          <!-- Ficha de detalle. Antes era un title nativo: tardaba un
               segundo en salir, no se podía dar estilo y se cortaba. -->
          <div class="tl-pop">
            <div class="tl-pop-head">
              <i class="${it._icon}" aria-hidden="true"></i>
              <div>
                <strong>${tx(it.role)}</strong>
                <span class="tl-pop-org">${bandera ? bandera + ' ' : ''}${tx(it.org)}</span>
              </div>
            </div>
            <p class="tl-pop-dates">${formatDate(it.start)} – ${endTxt}${dur ? ` · ${dur}` : ''}</p>
            ${metaLine ? `<p class="tl-pop-meta">${metaLine}</p>` : ''}
            ${bullets ? `<ul class="tl-pop-bullets">${bullets}</ul>` : ''}
            ${skills ? `<div class="tl-pop-skills">${skills}</div>` : ''}
            <p class="tl-pop-hint" data-i18n="timeline.zoomHint">Pulsa para acercar a este periodo</p>
          </div>
        </div>`;
    }).join('');

    const zoomBar = zoom
      ? `<button type="button" class="tl-reset">
           <i class="ri-close-line" aria-hidden="true"></i>
           <span data-i18n="timeline.showAll">Ver todo el recorrido</span>
           <b>${minY}–${maxY}</b>
         </button>`
      : '';

    container.innerHTML = `
      <section class="timeline-map">
        <div class="tl-top">
          <div class="tl-legend">${legend}</div>
          ${zoomBar}
        </div>
        <div class="tl-scroll">
          <div class="tl-chart">
            <div class="tl-axis"><div class="tl-axis-track">${axis}</div></div>
            <div class="tl-body">
              <div class="tl-gridlines">${grid}
                ${nowM >= from && nowM <= to ? `<span class="tl-now" style="left:${pct(nowM)}%"></span>` : ''}
              </div>
              ${rows}
            </div>
          </div>
        </div>
        <p class="tl-hint" data-i18n="timeline.mapHint">Cada barra es una etapa; las que se cruzan en vertical ocurrieron a la vez.</p>
      </section>`;

    if (window.applyI18n) window.applyI18n(container);
  }

  // Dibuja la sección activa
  function renderSection(sectionKey) {
    if (sectionKey === 'all') return renderMap();
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
            const endTxt = it.end && String(it.end).trim() ? formatDate(it.end) : present;
            const startTxt = formatDate(it.start);
            const range = startTxt ? `${startTxt} – ${endTxt}` : '';
            const dur = formatDuration(it.start, it.end);
            const bullets = (it.bullets || []).map(b => `<li>${tx(b)}</li>`).join('');
            // Línea secundaria: jornada y lugar, solo si existen
            const metaLine = [tx(it.employment), tx(it.location)].filter(Boolean).join(' · ');
            const skills = (it.skills || []).map(sk => `<span class="tl-skill">${sk}</span>`).join('');
            return `
              <li class="timeline-item reveal">
                <div class="timeline-card">
                  <div class="timeline-header">
                    <div class="title-wrap">
                      <i class="timeline-icon ${meta.icon}" aria-hidden="true"></i>
                      <h3>${tx(it.role)} — <span class="org">${tx(it.org)}</span></h3>
                    </div>
                    ${range ? `<span class="dates">${range}${dur ? `<span class="duration">${dur}</span>` : ''}</span>` : ''}
                  </div>
                  ${metaLine ? `<p class="tl-meta">${metaLine}</p>` : ''}
                  <ul class="bullets">${bullets}</ul>
                  ${skills ? `<div class="tl-skills">${skills}</div>` : ''}
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
    if (sectionKey !== activeSection) zoom = null;
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

  /* ZOOM DEL MAPA
     Pulsar una fila acerca el eje a su periodo con un año de margen.
     Pulsar la misma otra vez, o el botón de volver, muestra todo.
     Va delegado en el contenedor porque el mapa se repinta entero en
     cada cambio y un listener puesto sobre una fila moriría con ella. */
  function attachMapEvents(){
    container.addEventListener('click', (e) => {
      if (e.target.closest('.tl-reset')) { zoom = null; return renderMap(); }
      const row = e.target.closest('.tl-row');
      if (!row) return;
      const a = +row.dataset.from, b = +row.dataset.to;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      const nuevo = { from: a - 12, to: b + 12 };
      // Pulsar la fila ya enfocada vuelve a la vista completa
      zoom = (zoom && zoom.from === nuevo.from && zoom.to === nuevo.to) ? null : nuevo;
      renderMap();
    });
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.tl-row');
      if (!row) return;
      e.preventDefault();
      row.click();
    });
  }

  // Enlaza eventos de pestañas, buscador e idioma
  function attachEvents(){
    attachMapEvents();
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
        // Buscando, el recorte a un periodo estorba más que ayuda
        zoom = null;
        renderSection(activeSection);
      });
    }
    document.addEventListener('i18n:updated', ()=>{ buildTabs(); renderSection(activeSection); });
  }

  // Arranque de la UI: elige la primera sección con datos
  function initUI(){
    const available = SECTIONS.find(s => (s.dataKey ? (data[s.dataKey]||[]).length : allEntries().length) > 0);
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

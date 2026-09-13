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
  if (!container) return; // solo corre en portfolio.html

  /* ------------------------------------------------------------
     PORTADAS DE CATEGORÍA
     Una imagen por categoría en assets/img/brand/covers/<cat>.jpg.
     Sirven para dos cosas: fondo de las fichas que no tienen imagen
     propia, y banner al filtrar por esa categoría.

     Nunca damos por hecho que el archivo existe: lo cargamos primero
     y solo si responde publicamos la variable CSS --cover-<cat>. Las
     reglas de main.css la usan con el degradado de siempre como
     valor por defecto, así que una portada que falte no rompe nada,
     simplemente no se nota.
     ------------------------------------------------------------ */
  /* Resuelve un campo de datos que puede venir como texto plano o como
     {es,en,pt}. Igual que en skills.js: así los proyectos ya traducidos
     conviven con los que todavía están en un solo idioma. */
  function tx(value, fallback){
    if (value == null) return fallback || '';
    if (typeof value === 'string') return value;
    const lang = document.documentElement.lang || 'es';
    return value[lang] || value.en || value.es || fallback || '';
  }
  // Igual, para listas de textos (features, results…)
  function txList(arr){
    return (Array.isArray(arr) ? arr : []).map(v => tx(v, '')).filter(Boolean);
  }

  // Etiqueta traducida del panel. window.t lo expone i18n.js; si aún no
  // cargó, devuelve el texto de respaldo en español.
  function L(key, fallback){
    return (window.t ? window.t('portfolio.panel.' + key, fallback) : fallback);
  }

  const COVER_DIR = 'assets/img/brand/covers/';
  const coverReady = {}; // categoría -> true cuando la imagen cargó

  // Se aceptan varias extensiones para no obligar a reconvertir la imagen:
  // se prueba una detrás de otra y se usa la primera que cargue.
  const COVER_EXT = ['png', 'jpg', 'jpeg', 'webp'];
  const coverSrc = {}; // categoría -> URL que funcionó

  // URL absoluta a propósito: una url() relativa dentro de una variable
  // CSS se resuelve contra la HOJA DE ESTILOS (css/main.css), no contra la
  // página, y acabaría apuntando a /css/assets/... que no existe.
  function coverUrl(cat){
    return coverSrc[cat] || new URL(`${COVER_DIR}${cat}.${COVER_EXT[0]}`, document.baseURI).href;
  }

  // Carga una URL concreta y dice si existe
  function tryLoad(url){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function probeCover(cat){
    for (const ext of COVER_EXT) {
      const url = new URL(`${COVER_DIR}${cat}.${ext}`, document.baseURI).href;
      if (await tryLoad(url)) {
        coverSrc[cat] = url;
        coverReady[cat] = true;
        document.documentElement.style.setProperty(`--cover-${cat}`, `url('${url}')`);
        return true;
      }
    }
    coverReady[cat] = false;
    return false;
  }

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
      const hay = [p.title, tx(p.summary), p.category, techText, tagText, p.role, tx(p.client), tx(p.discipline), p.id].join(' ').toLowerCase();
      return hay.includes(state.q);
    }

    /* Banner con la portada de la categoría filtrada.
       Va DENTRO de la rejilla ocupando toda la fila (grid-column:1/-1),
       igual que el panel de detalle. Así queda alineado con las fichas
       por construcción: el ancho de la rejilla lo deciden sus columnas,
       no un max-width, y replicarlo desde fuera no cuadraba.
       No aparece con "Todo", con "nuevo", ni si esa portada no existe. */
    function bannerHtml(){
      const cat = state.filter;
      if (!cat || cat === 'all' || cat === 'nuevo' || !coverReady[cat]) return '';
      // El nombre visible sale del propio botón de filtro, que ya está traducido
      const chip = document.querySelector(`.filters [data-filter="${cat}"] span`);
      const label = chip ? chip.textContent.trim() : cat;
      return `<div class="category-banner"><div class="category-banner-img" style="background-image:url('${coverUrl(cat)}')" role="img" aria-label="${label}"></div></div>`;
    }

    // Repinta solo si el banner cambia (las portadas llegan tarde, async)
    function updateBanner(){
      const current = container.querySelector('.category-banner');
      const wanted = bannerHtml();
      if ((wanted && !current) || (!wanted && current)) render();
    }

    /* Con el filtro "software" añadimos una tarjeta más que lleva al
       listado automático de repositorios de GitHub. Va en la propia
       rejilla, como una tarjeta cualquiera, en vez de como un botón
       suelto debajo. */
    function githubCardHtml(){
      if (state.filter !== 'software') return '';
      return `
        <a class="project-card project-tile github-tile" href="programming.html" data-category="software"
           aria-label="${L('githubCard','Portafolio de GitHub')}">
          <div class="project-overlay">
            <h3 class="project-title"><i class="ri-github-fill" aria-hidden="true"></i> ${L('githubCard','Portafolio de GitHub')}</h3>
            <span class="project-year">${L('githubCardHint','Todos mis repositorios públicos')}</span>
          </div>
        </a>`;
    }

    /* ------------------------------------------------------------
       AGRUPACIÓN POR TIPO
       Dentro de una categoría, los proyectos pueden llevar "type"
       (frontend, backend, infra…). Cuando los hay, la rejilla se
       parte en bloques con su encabezado en vez de ser una lista
       plana: con 25 proyectos de software, saber cuál es de qué
       importa más que verlos todos seguidos.
       ------------------------------------------------------------ */
    const TYPE_ORDER = ['frontend','backend','media','infra','data','observability','docs'];

    function typeLabel(t){
      return (window.t ? window.t('portfolio.types.' + t, t) : t);
    }

    // Agrupa respetando TYPE_ORDER; los que no tengan tipo van al final
    function groupByType(items){
      const groups = new Map();
      items.forEach(p => {
        const key = p.type && TYPE_ORDER.includes(p.type) ? p.type : '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      });
      return [...groups.entries()].sort((a,b) => {
        const ia = a[0] ? TYPE_ORDER.indexOf(a[0]) : 999;
        const ib = b[0] ? TYPE_ORDER.indexOf(b[0]) : 999;
        return ia - ib;
      });
    }

    function groupHeadingHtml(type, count){
      if (!type) return '';
      return `<h3 class="type-heading">${typeLabel(type)}<span class="type-count">${count}</span></h3>`;
    }

    // Dibuja (o re-dibuja) todas las tarjetas visibles
    function render(){
      const items = sortProjects(projects.filter(matches));
      if (!items.length) { container.innerHTML = bannerHtml() + '<p class="empty-state">No projects found.</p>' + githubCardHtml(); return; }

      /* Agrupamos solo dentro de una categoría concreta. Con "Todo" no:
         ahí conviven proyectos con tipo y sin él, y saldrían unos cuantos
         encabezados seguidos de un bloque enorme sin encabezar. */
      const inOneCategory = state.filter && state.filter !== 'all' && state.filter !== 'nuevo';
      const useGroups = inOneCategory && items.some(p => p.type && TYPE_ORDER.includes(p.type));
      const tileHtml = p => {
        const raw = p.thumb || (Array.isArray(p.images) && p.images[0]) || '';
        // Si la imagen es el logo genérico, usamos un degradado CSS en su lugar
        const isPlaceholder = !raw || /(^|\/)HOme\.png$/i.test(raw) || /assets\/img\/brand\/HOme\.png$/i.test(raw);
        const bgStyle = isPlaceholder ? '' : ` style="background-image:url('${raw}')"`;
        // cover-bg = la ficha usa la portada de su categoría, no el degradado.
        // Las portadas claras necesitan un velo más oscuro o el título no se lee.
        const cls = isPlaceholder ? (coverReady[p.category] ? ' no-image cover-bg' : ' no-image') : '';
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
      };

      // La tarjeta de GitHub va al final: arriba dejaba media fila vacía,
      // porque el encabezado del primer grupo empieza línea nueva.
      container.innerHTML = bannerHtml() + (useGroups
        ? groupByType(items).map(([type, list]) =>
            groupHeadingHtml(type, list.length) + list.map(tileHtml).join('')).join('')
        : items.map(tileHtml).join('')) + githubCardHtml();

      // Al re-renderizar, cualquier panel abierto desaparece
      openPanel = null;
      openProjectId = null;
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

      /* Vista previa en vivo: si el proyecto tiene demo, un botón la
         incrusta en un iframe dentro del propio panel. El iframe se
         crea vacío y solo carga la web al pulsar, para no descargar
         cuatro sitios enteros cada vez que se abre el portafolio. */
      const preview = p.links?.demo ? `
        <div class="section project-preview">
          <button type="button" class="btn orange toggle-preview" aria-expanded="false">
            <i class="ri-eye-line" aria-hidden="true"></i><span>${L('preview','Ver demo')}</span>
          </button>
          <iframe class="iframe" data-src="${p.links.demo}" title="${p.title}"
                  width="100%" height="${p.demoHeight || 400}" loading="lazy" hidden></iframe>
        </div>` : '';

      const links = `
        ${p.links?.demo ? `<a href="${p.links.demo}" target="_blank" rel="noopener">${L('demo','Demo')}</a>` : ''}
        ${p.links?.portfolio ? `<a href="${p.links.portfolio}" target="_blank" rel="noopener">${L('portfolio','Portafolio')}</a>` : ''}
        ${p.links?.video ? `<a href="${p.links.video}" target="_blank" rel="noopener">${L('video','Video')}</a>` : ''}
        ${p.links?.repo ? `<a href="${p.links.repo}" target="_blank" rel="noopener">${L('repo','Código')}</a>` : ''}
      `;

      const badges = `
        ${isNew(p) ? `<span class="badge badge--nuevo"><i class="ri-sparkling-line" aria-hidden="true"></i><span data-i18n="filters.nuevo">Nuevo</span></span>` : ''}
        ${p.category ? `<span class="badge"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${p.category}</span>` : ''}
        ${tx(p.status) ? `<span class="badge badge--status"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>${tx(p.status)}</span>` : ''}
        ${p.importance ? `<span class="badge badge--importance"><i class="ri-star-smile-line" aria-hidden="true"></i>${p.importance}</span>` : ''}
      `;

      const metaItems = [
        tx(p.client) ? `<div class="meta-item"><label>${L('client','Cliente')}</label><div class="value">${tx(p.client)}</div></div>` : '',
        tx(p.discipline) ? `<div class="meta-item"><label>${L('discipline','Disciplina')}</label><div class="value">${tx(p.discipline)}</div></div>` : '',
        p.team ? `<div class="meta-item"><label>${L('team','Integrantes')}</label><div class="value">${Array.isArray(p.team)? p.team.join(', ') : p.team}</div></div>` : '',
        tx(p.contribution) ? `<div class="meta-item"><label>${L('contribution','Contribución')}</label><div class="value">${tx(p.contribution)}</div></div>` : '',
        p.state ? `<div class="meta-item"><label>${L('state','Estado')}</label><div class="value">${p.state}</div></div>` : ''
      ].filter(Boolean).join('');

      const features = txList(p.features).map(f => `<li>${f}</li>`).join('');
      const results = txList(p.results).map(r => `<li>${r}</li>`).join('');
      const gallery = (Array.isArray(p.images)? p.images.slice(0,6) : []).map((src, i) => `<img src="${src}" alt="${p.title} ${i+1}" loading="lazy" tabindex="0" role="button" aria-label="Ampliar imagen ${i+1} de ${p.title}">`).join('');

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
        ${tx(p.summary) ? `<div class="section"><div class="section-header"><h4>${L('description','Descripción')}</h4></div><p class="project-summary">${tx(p.summary)}</p></div>` : ''}
        <div class="project-sections">
          <div class="section">
            <div class="section-header"><h4>${L('details','Detalles')}</h4></div>
            <div class="meta-grid">${metaItems}</div>
          </div>
          <div class="section">
            <div class="section-header"><h4>${L('tech','Tecnologías')}</h4></div>
            <div class="chips">${techChips}</div>
          </div>
          ${features ? `<div class="section"><div class="section-header"><h4>${L('features','Características')}</h4></div><ul class="feature-list">${features}</ul></div>` : ''}
          ${tx(p.learnings) ? `<div class="section"><div class="section-header"><h4>${L('learnings','Aprendizajes')}</h4></div><p>${tx(p.learnings)}</p></div>` : ''}
          ${results ? `<div class="section"><div class="section-header"><h4>${L('results','Resultados')}</h4></div><ul class="result-list">${results}</ul></div>` : ''}
          ${gallery ? `<div class="section"><div class="section-header"><h4>${L('gallery','Galería')}</h4></div><div class="gallery">${gallery}</div></div>` : ''}
          ${links.trim() ? `<div class="section"><div class="link-buttons">${links}</div></div>` : ''}
          ${preview}
        </div>
      `;
      return panel;
    }

    /* ------------------------------------------------------------
       ENLACE DIRECTO A UN PROYECTO  (portfolio.html?p=<id>)
       La página de Habilidades enlaza aquí desde cada chip de
       proyecto, así que al llegar hay que abrir ese panel solo.
       ------------------------------------------------------------ */
    function openFromQuery(){
      const params = new URLSearchParams(location.search);

      // ?filter=<categoría> deja la página ya filtrada (lo usa el enlace
      // de vuelta desde la página de repositorios de GitHub).
      const f = params.get('filter');
      if (f && document.querySelector(`.filters [data-filter="${f}"]`)) {
        state.filter = f;
        document.querySelectorAll('.filters [data-filter]').forEach(b =>
          b.classList.toggle('active', b.getAttribute('data-filter') === f));
        render();
      }

      const id = params.get('p');
      if (!id) return;
      const p = projects.find(pp => pp.id === id);
      if (!p || p.visible === false) return;
      // Si el proyecto está fuera del filtro actual, pasamos a "todos"
      if (!matches(p)) {
        state.filter = 'all';
        state.q = '';
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.filters [data-filter]').forEach(b =>
          b.classList.toggle('active', b.getAttribute('data-filter') === 'all'));
        render();
      }
      const card = container.querySelector(`.project-tile[data-id="${CSS.escape(id)}"]`);
      if (card) card.click();
    }

    /* ------------------------------------------------------------
       LIGHTBOX: ampliar las imágenes de la galería
       Se crea una sola vez y se reutiliza. Se cierra con Escape,
       con la X o pulsando el fondo; las flechas cambian de imagen.
       ------------------------------------------------------------ */
    const lb = (() => {
      let el = null, imgs = [], idx = 0, lastFocus = null;

      function build(){
        el = document.createElement('div');
        el.className = 'lightbox';
        el.setAttribute('role','dialog');
        el.setAttribute('aria-modal','true');
        el.setAttribute('aria-label','Imagen ampliada');
        el.hidden = true;

        /* Lo que hace que esto sea una SUPERPOSICION va aqui en linea,
           no solo en main.css. Si el navegador sirve una copia antigua
           de la hoja de estilos, el div se quedaria sin reglas y se
           dibujaria como un bloque normal al final del <body>: es decir,
           la imagen enorme abajo del todo en vez de encima de la pagina.
           Con estos estilos en linea eso no puede pasar.
           `inset` se acompana de top/right/bottom/left porque Safari
           anterior a 14.1 no entiende la forma corta, y sin offsets un
           position:fixed cae tambien al final del documento. */
        Object.assign(el.style, {
          position: 'fixed',
          top: '0', right: '0', bottom: '0', left: '0',
          zIndex: '2000',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 6, 23, .92)',
          display: 'none'   // open() lo pasa a 'flex'
        });

        el.innerHTML = `
          <button class="lightbox-close" type="button" aria-label="Cerrar"><i class="ri-close-line" aria-hidden="true"></i></button>
          <button class="lightbox-nav prev" type="button" aria-label="Anterior"><i class="ri-arrow-left-s-line" aria-hidden="true"></i></button>
          <figure class="lightbox-figure">
            <img alt="">
            <figcaption class="lightbox-caption"></figcaption>
          </figure>
          <button class="lightbox-nav next" type="button" aria-label="Siguiente"><i class="ri-arrow-right-s-line" aria-hidden="true"></i></button>`;
        document.body.appendChild(el);

        el.addEventListener('click', (e) => {
          if (e.target.closest('.lightbox-close')) return close();
          if (e.target.closest('.lightbox-nav.prev')) return step(-1);
          if (e.target.closest('.lightbox-nav.next')) return step(1);
          // Clic en el fondo (fuera de la figura) también cierra
          if (!e.target.closest('.lightbox-figure')) close();
        });
        document.addEventListener('keydown', (e) => {
          if (el.hidden) return;
          if (e.key === 'Escape') close();
          else if (e.key === 'ArrowLeft') step(-1);
          else if (e.key === 'ArrowRight') step(1);
        });
      }

      function show(){
        const img = el.querySelector('img');
        // Mismo motivo que arriba: sin CSS la imagen saldria a tamaño real
        Object.assign(img.style, { maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain' });
        img.src = imgs[idx].src;
        img.alt = imgs[idx].alt || '';
        el.querySelector('.lightbox-caption').textContent = `${idx+1} / ${imgs.length}`;
        // Con una sola imagen las flechas no aportan nada
        const many = imgs.length > 1;
        el.querySelectorAll('.lightbox-nav').forEach(b => { b.hidden = !many; });
      }
      function step(d){ if (!imgs.length) return; idx = (idx + d + imgs.length) % imgs.length; show(); }

      function open(list, start){
        if (!el) build();
        imgs = list; idx = start;
        lastFocus = document.activeElement;
        el.hidden = false;
        el.style.display = 'flex';
        document.body.classList.add('lightbox-open');
        show();
        el.querySelector('.lightbox-close').focus();
      }
      function close(){
        el.hidden = true;
        el.style.display = 'none';
        document.body.classList.remove('lightbox-open');
        // Devolver el foco a la miniatura desde la que se abrió
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      return { open };
    })();

    /* Mostrar / ocultar la vista previa incrustada. El src se asigna
       la primera vez que se pulsa: así la demo no se descarga hasta
       que alguien la pide. */
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-preview');
      if (!btn) return;
      e.stopPropagation();
      const frame = btn.parentElement.querySelector('iframe.iframe');
      if (!frame) return;
      const show = frame.hidden;
      if (show && !frame.src) frame.src = frame.dataset.src || '';
      frame.hidden = !show;
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
      const label = btn.querySelector('span');
      if (label) label.textContent = show ? L('hidePreview','Ocultar demo') : L('preview','Ver demo');
    });

    // Clic en una miniatura de la galería → abrir el lightbox
    container.addEventListener('click', (e) => {
      const img = e.target.closest('.project-details-panel .gallery img');
      if (!img) return;
      e.stopPropagation(); // que no se cierre el panel de detalles
      const all = [...img.closest('.gallery').querySelectorAll('img')];
      lb.open(all.map(i => ({ src: i.src, alt: i.alt })), all.indexOf(img));
    });

    // Teclado en las miniaturas (son focusables vía tabindex)
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const img = e.target.closest('.project-details-panel .gallery img');
      if (!img) return;
      e.preventDefault(); e.stopPropagation();
      img.click();
    });

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

    // Al cambiar de idioma hay que rehacer el panel: sus títulos y
    // etiquetas se generan aquí, no llevan data-i18n en el HTML.
    document.addEventListener('i18n:updated', () => {
      const reopen = openProjectId;
      render();
      if (reopen) {
        const card = container.querySelector(`.project-tile[data-id="${CSS.escape(reopen)}"]`);
        if (card) card.click();
      }
    });

    render(); // primer dibujado
    openFromQuery(); // ?p=<id> → abrir ese proyecto directamente

    // Buscar las portadas en segundo plano: la página ya está usable
    // y, según van llegando, las fichas y el banner se actualizan solos.
    const cats = [...new Set(projects.map(p => p.category).filter(Boolean))];
    // Al terminar se redibuja una vez: las fichas reciben su clase cover-bg
    // y aparece el banner si toca. Antes solo se comprobaba el banner, así
    // que con el filtro "Todo" las fichas se quedaban sin la portada.
    Promise.all(cats.map(probeCover)).then(() => {
      const reopen = openProjectId;
      render();
      if (reopen) {
        const card = container.querySelector(`.project-tile[data-id="${CSS.escape(reopen)}"]`);
        if (card) card.click();
      }
    });
  } catch (err) {
    console.error('Failed to load projects', err);
    container.innerHTML = '<p style="padding:12px;">Projects could not load. Please serve the site with a local server or open the deployed GitHub Pages site.</p>';
  }
})();

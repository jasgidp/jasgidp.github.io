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
  /* Escapa texto que se mete en un atributo HTML. Las rutas de imagen y
     las claves de categoría salen del JSON, así que una comilla suelta
     rompería el atributo y con él la fila entera. */
  function esc(str){
    return String(str == null ? '' : str)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

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
    // hideCover se rellena cuando existe la preview a media pantalla (solo Todo)
    let hideCover = () => {};

    /* Lo que se puede pulsar para abrir el panel de detalles. Con un
       filtro concreto son las fichas con portada (.project-tile); con
       "Todo" son las filas del índice (.index-row). El resto del código
       (clic, teclado, ?p=<id>) no necesita saber cuál de las dos es. */
    const CARD_SEL = '.project-tile, .index-row, .ix-thumb';
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

    // ¿Este proyecto debe mostrarse con el filtro/búsqueda actuales?
    function matches(p){
      if (p.visible === false) return false; // ocultos a propósito
      if (state.filter !== 'all' && p.category !== state.filter) {
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
      if (!cat || cat === 'all' || !coverReady[cat]) return '';
      // El nombre visible sale del propio botón de filtro, que ya está traducido
      const chip = document.querySelector(`.filters [data-filter="${cat}"] span`);
      const label = chip ? chip.textContent.trim() : cat;
      return `<div class="category-banner">
        <div class="category-banner-img" style="background-image:url('${coverUrl(cat)}')" role="img" aria-label="${esc(label)}"></div>
      </div>`;
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
    function githubCardHtml(force){
      if (!force && state.filter !== 'software') return '';
      return `
        <a class="project-card project-tile github-tile" href="programming.html" data-category="software"
           aria-label="${L('githubCard','Portafolio de GitHub')}">
          <div class="project-tile-shot"></div>
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
    const TYPE_ORDER = [
      // software
      'frontend','backend','media','infra','data','observability','docs',
      // diseño gráfico
      'digital-experience','brand','illustration','infographic','social','publicity',
      // diseño de producto
      'furniture','modeling','concept','maker'
    ];

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

    /* ------------------------------------------------------------
       ÍNDICE EDITORIAL  (vista "Todo")
       Con un filtro puesto, la rejilla de portadas funciona: son pocos
       proyectos de un mismo tipo y la imagen distingue. Pero en "Todo"
       son 77 fichas iguales, con el mismo logo de fondo, donde no se
       lee nada salvo el título recortado.

       Así que "Todo" deja de ser una rejilla y pasa a ser un índice:
       una fila por proyecto, agrupadas por tema. Al pasar el cursor la
       fila se abre y entra el resumen, y la portada flota junto al
       cursor. Se agrupa por TEMA y no por año a propósito: los años
       viejos son casi todo diseño gráfico y los nuevos casi todo
       software, así que un índice cronológico se leería como un
       cambio de oficio en vez de como dos oficios a la vez. El año va
       igual en cada fila, así que no se pierde.
       ------------------------------------------------------------ */
    // Software al final: en "Todo" primero lo visual y el código al cierre.
    const CATEGORY_ORDER = ['design','graphic','engineering','research','experience','software'];

    // El nombre visible de la categoría sale del botón de filtro, que
    // i18n.js ya mantiene traducido. Así no hay una segunda lista que
    // se quede desincronizada.
    function catLabel(cat){
      const chip = document.querySelector(`.filters [data-filter="${cat}"] span`);
      return chip ? chip.textContent.trim() : cat;
    }

    function groupByCategory(items){
      const groups = new Map();
      items.forEach(p => {
        const key = p.category || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      });
      return [...groups.entries()].sort((a,b) => {
        const ia = CATEGORY_ORDER.indexOf(a[0]); const ib = CATEGORY_ORDER.indexOf(b[0]);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }

    // Tecnologías en una línea, como pie de la fila. Admite array plano
    // y el objeto agrupado {languages, frameworks, tools}.
    function techLine(p){
      if (!p.tech) return '';
      const flat = Array.isArray(p.tech) ? p.tech : [
        ...(Array.isArray(p.tech.languages) ? p.tech.languages : []),
        ...(Array.isArray(p.tech.frameworks) ? p.tech.frameworks : []),
        ...(Array.isArray(p.tech.tools) ? p.tech.tools : [])
      ];
      return flat.slice(0, 5).join(' · ');
    }

    /* Todas las imágenes del proyecto, sin el logotipo genérico, que no
       dice nada de un proyecto concreto. Lo usan la fila, la tira de
       miniaturas y la imagen a media pantalla. */
    function imagesOf(p){
      const todas = [p.thumb, ...(Array.isArray(p.images) ? p.images : [])]
        .filter(src => src && !/HOme\.png$/i.test(src));
      return [...new Set(todas)];
    }

    function indexRowHtml(p){
      const imgs = imagesOf(p);
      const thumb = imgs[0] || '';
      const isPlaceholder = !thumb;
      const tech = techLine(p);
      const summary = tx(p.summary);
      return `
        <article class="index-row" data-category="${p.category}" data-id="${p.id}"
                 data-thumb="${isPlaceholder ? '' : thumb}"
                 data-imgs="${esc(imgs.join('|'))}"
                 tabindex="0" role="button" aria-label="${L('openDetails','Ver detalles de')} ${p.title}">
          <span class="ix-dot" aria-hidden="true"></span>
          <h3 class="ix-title">${p.title}</h3>
          <span class="ix-lead" aria-hidden="true"></span>
          <span class="ix-meta">
            <span class="ix-year">${p.year || ''}</span>
          </span>
          <i class="ri-arrow-right-up-line ix-arrow" aria-hidden="true"></i>
          <div class="ix-body"><div class="ix-body-inner">
            ${summary ? `<p class="ix-summary">${summary}</p>` : ''}
            ${tech ? `<p class="ix-tech">${tech}</p>` : ''}
          </div></div>
        </article>`;
    }

    /* DOS COLUMNAS, Y CADA UNA CON SU PROPIO FLUJO
       Una sola columna de 77 filas se leía como una lista por larga.
       Partirla en dos la acorta a la mitad y la acerca a un índice
       impreso. Son dos <div> independientes y no una rejilla de dos
       columnas a propósito: en una rejilla, abrir el resumen de una
       fila estira toda la franja y empuja también la fila de al lado,
       que da un salto molesto al mover el ratón en diagonal. Con dos
       listas, abrir algo en la izquierda no toca la derecha.

       Se reparte por mitades (1..n en la izquierda, n+1.. en la
       derecha) y no alternando, para que la numeración siga siendo
       corrida al bajar por cada columna. En móvil se apilan y el orden
       global se mantiene. */
    const INDEX_COLS = 2;

    /* Reparte bloques entre columnas equilibrando el número de FILAS,
       no el de bloques: "Software" tiene subtipos de 2 y de 6, así que
       repartir 4 y 3 bloques dejaba una columna al doble de alto. */
    function balancear(bloques, cols){
      const cubos = Array.from({ length: cols }, () => ({ items: [], n: 0 }));
      bloques.forEach(b => {
        const menor = cubos.reduce((a, c) => (c.n < a.n ? c : a), cubos[0]);
        menor.items.push(b); menor.n += b.count;
      });
      return cubos.map(c => c.items);
    }

    /* TIRA DE PORTADAS
       Con subtipos: bajo cada rótulo (Frontend, Marca…).
       Sin subtipos (Ingeniería, Investigación, Experiencia): una sola
       tira centrada bajo el título de la sección grande.

       Al señalar una miniatura se abre la fila de ese proyecto (con su
       resumen) y sale su imagen a media pantalla, igual que al señalar
       la fila. Al pulsarla se abre el panel completo.

       Los proyectos sin imagen propia no salen en la tira. */
    function stripHtml(list, { centered = false, min = 2 } = {}){
      const conImagen = list.filter(p => imagesOf(p).length);
      if (conImagen.length < min) return '';
      const cls = centered ? 'ix-strip ix-strip--section' : 'ix-strip';
      return `<div class="${cls}">
        ${conImagen.map(p => `
          <button type="button" class="ix-thumb" data-id="${esc(p.id)}"
                  aria-label="${esc(p.title)}">
            <span class="ix-thumb-media" style="background-image:url('${esc(imagesOf(p)[0])}')" aria-hidden="true"></span>
            <span class="ix-thumb-name">${esc(p.title)}</span>
          </button>`).join('')}
      </div>`;
    }

    function subHeadingHtml(type, count){
      return `<h3 class="ix-sub-heading">
          <span>${typeLabel(type)}</span><span class="ix-sub-count">${count}</span>
        </h3>`;
    }

    /* SUBCATEGORÍAS DENTRO DE CADA TEMA
       Con subtipos (Software, Gráfico, Producto): la tira va BAJO cada
       subtipo, en la misma columna que sus filas. Así no pasa que el
       proyecto esté a la izquierda y su miniatura "flote" a la derecha
       (como Center Box en Mobiliario vs la galería del otro lado).

       Sin subtipos (Ingeniería, Investigación, Experiencia): una sola
       tira centrada bajo el título de la sección grande. */
    // Enlace a Programming/GitHub al pie del bloque Software en "Todo".
    function indexGithubHtml(){
      return `<a class="ix-github" href="programming.html">
          <i class="ri-github-fill" aria-hidden="true"></i>
          <span class="ix-github-label">${L('githubCard','Portafolio de GitHub')}</span>
          <span class="ix-github-hint">${L('githubCardHint','Todos mis repositorios públicos')}</span>
          <i class="ri-arrow-right-up-line" aria-hidden="true"></i>
        </a>`;
    }

    function indexHtml(items){
      return `<div class="project-index">` + groupByCategory(items).map(([cat, list]) => {
        const porTipo = groupByType(list).filter(([type]) => type);
        const conTipo = porTipo.reduce((n, [, l]) => n + l.length, 0);
        const usarSub = conTipo === list.length && porTipo.length > 1;

        let cuerpo;
        let sectionStrip = '';
        if (usarSub) {
          const bloques = porTipo.map(([type, l]) => ({
            count: l.length,
            html: `<section class="ix-sub">${subHeadingHtml(type, l.length)}
                     ${stripHtml(l, { min: 1 })}
                     <div class="ix-rows">${l.map(indexRowHtml).join('')}</div>
                   </section>`
          }));
          cuerpo = balancear(bloques, INDEX_COLS)
            .map(col => `<div class="ix-col">${col.map(b => b.html).join('')}</div>`).join('');
        } else {
          sectionStrip = stripHtml(list, { centered: true, min: 1 });
          const per = Math.ceil(list.length / INDEX_COLS);
          const trozos = [];
          for (let i = 0; i < list.length; i += per) trozos.push(list.slice(i, i + per));
          cuerpo = trozos
            .map(col => `<div class="ix-col"><div class="ix-rows">${col.map(indexRowHtml).join('')}</div></div>`).join('');
        }

        const github = cat === 'software' ? indexGithubHtml() : '';
        return `<section class="ix-group" data-category="${esc(cat)}">
            <h2 class="ix-heading"><span class="ix-heading-name">${catLabel(cat)}</span>`
             + `<span class="ix-heading-count">${list.length}</span></h2>
            ${sectionStrip}
            <div class="ix-cols">${cuerpo}</div>
            ${github}
          </section>`;
      }).join('') + `</div>`;
    }

    // Dibuja (o re-dibuja) todas las tarjetas visibles
    function render(){
      const items = sortProjects(projects.filter(matches));
      if (!items.length) {
        container.classList.remove('index');
        let html = bannerHtml() + '<p class="empty-state">No projects found.</p>';
        if (state.filter === 'software') {
          container.classList.add('index');
          html += `<div class="project-index">${indexGithubHtml()}</div>`;
        }
        container.innerHTML = html;
        hideCover();
        return;
      }

      /* Todo: índice actual. Categorías: tira grande + lista. */
      container.classList.add('index');
      if (state.filter === 'all') {
        container.innerHTML = indexHtml(items);
      } else {
        container.innerHTML = bannerHtml() + filterIndexHtml(items);
      }

      openPanel = null;
      openProjectId = null;
      hideCover();
      if (window.applyI18n) window.applyI18n(document);
    }

    /* Vista filtrada: tira grande + lista (misma interacción que Todo). */
    function filterIndexHtml(items){
      if (!items.length) return '';
      const cat = items[0].category || state.filter;
      const porTipo = groupByType(items).filter(([type]) => type);
      const conTipo = porTipo.reduce((n, [, l]) => n + l.length, 0);
      const usarSub = conTipo === items.length && porTipo.length > 1;

      let bloques;
      if (usarSub) {
        bloques = porTipo.map(([type, l]) => `
          <section class="ix-sub">${subHeadingHtml(type, l.length)}
            ${stripHtml(l, { centered: true, min: 1 })}
            <div class="ix-rows">${l.map(indexRowHtml).join('')}</div>
          </section>`).join('');
      } else {
        bloques = `
          ${stripHtml(items, { centered: true, min: 1 })}
          <div class="ix-rows">${items.map(indexRowHtml).join('')}</div>`;
      }

      const github = state.filter === 'software' ? indexGithubHtml() : '';
      return `<div class="project-index">
        <section class="ix-group ix-group--filter" data-category="${esc(cat)}">
          ${bloques}
          ${github}
        </section>
      </div>`;
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
        ${p.category ? `<span class="badge"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${p.category}</span>` : ''}
        ${tx(p.status) ? `<span class="badge badge--status"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>${tx(p.status)}</span>` : ''}
        ${tx(p.importance) ? `<span class="badge badge--importance"><i class="ri-star-smile-line" aria-hidden="true"></i>${tx(p.importance)}</span>` : ''}
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
      const card = container.querySelector(`[data-id="${CSS.escape(id)}"]`);
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

    /* Preview a media pantalla: solo en "Todo". Dentro de una categoría
       basta con ampliar la fila; la imagen grande estorba. */
    const hoverCover = (() => {
      const MS = 1100;
      const DELAY = 1000;
      let el = null, capas = [], arriba = 0;
      let list = [], i = 0, timer = 0, delayTimer = 0;
      let waitingKey = '';

      function ensure(){
        if (el) return el;
        el = document.createElement('div');
        el.className = 'ix-cover';
        el.setAttribute('aria-hidden', 'true');
        Object.assign(el.style, {
          position: 'fixed', top: '0', bottom: '0', height: '100vh',
          width: '50vw', zIndex: '5', overflow: 'hidden',
          pointerEvents: 'none', opacity: '0'
        });
        capas = [0, 1].map(() => {
          const c = document.createElement('div');
          c.className = 'ix-cover-media';
          Object.assign(c.style, {
            position: 'absolute', inset: '0',
            backgroundSize: 'contain', backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: '0', transition: 'opacity .55s ease'
          });
          el.appendChild(c);
          return c;
        });
        document.body.appendChild(el);
        return el;
      }

      function paint(n){
        const src = list[n];
        if (!src) return;
        const ver = capas[arriba], ocultar = capas[arriba ? 0 : 1];
        ver.style.backgroundImage = `url('${src}')`;
        ver.style.opacity = '1';
        ocultar.style.opacity = '0';
        arriba = arriba ? 0 : 1;
      }

      function stop(){ if (timer) { clearInterval(timer); timer = 0; } }

      function place(alaDerecha){
        const e = ensure();
        e.style.left = alaDerecha ? 'auto' : '0';
        e.style.right = alaDerecha ? '0' : 'auto';
        e.classList.toggle('from-right', alaDerecha);
        e.classList.toggle('from-left', !alaDerecha);
      }

      function reveal(srcs, alaDerecha){
        const e = ensure();
        place(alaDerecha);
        const key = srcs.join('|');
        if (e.dataset.key !== key) {
          e.dataset.key = key;
          list = srcs; i = 0; arriba = 0;
          stop();
          capas.forEach(c => { c.style.opacity = '0'; });
          paint(0);
          if (list.length > 1) {
            timer = setInterval(() => { i = (i + 1) % list.length; paint(i); }, MS);
          }
        }
        e.style.opacity = '1';
      }

      return {
        show(srcs, alaDerecha){
          if (state.filter !== 'all') return this.hide();
          if (!srcs || !srcs.length) return this.hide();
          const key = srcs.join('|');
          const e = el;
          if (e && e.dataset.key === key && e.style.opacity === '1') {
            place(alaDerecha);
            return;
          }
          if (waitingKey === key && delayTimer) {
            place(alaDerecha);
            return;
          }
          if (delayTimer) { clearTimeout(delayTimer); delayTimer = 0; }
          if (e && e.style.opacity === '1') {
            e.style.opacity = '0';
            stop();
            e.dataset.key = '';
          }
          waitingKey = key;
          ensure();
          place(alaDerecha);
          delayTimer = setTimeout(() => {
            delayTimer = 0;
            waitingKey = '';
            if (state.filter !== 'all') return;
            reveal(srcs, alaDerecha);
          }, DELAY);
        },
        hide(){
          waitingKey = '';
          if (delayTimer) { clearTimeout(delayTimer); delayTimer = 0; }
          stop();
          if (el) { el.style.opacity = '0'; el.dataset.key = ''; }
        }
      };
    })();
    hideCover = () => hoverCover.hide();

    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      function syncThumb(id){
        container.querySelectorAll('.ix-thumb.is-active').forEach(t => t.classList.remove('is-active'));
        if (!id) return;
        const thumb = container.querySelector(`.ix-thumb[data-id="${CSS.escape(id)}"]`);
        if (!thumb) return;
        thumb.classList.add('is-active');
        const strip = thumb.closest('.ix-strip');
        if (strip) {
          const tr = thumb.getBoundingClientRect();
          const sr = strip.getBoundingClientRect();
          if (tr.left < sr.left || tr.right > sr.right) {
            thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          }
        }
      }

      function marcarFila(id){
        container.querySelectorAll('.index-row.peek').forEach(r => r.classList.remove('peek'));
        syncThumb(id);
        if (!id) return null;
        const fila = container.querySelector(`.index-row[data-id="${CSS.escape(id)}"]`);
        if (fila) fila.classList.add('peek');
        return fila;
      }

      function coverSrcsFor(row){
        if (!row) return [];
        const own = (row.getAttribute('data-imgs') || '').split('|').filter(Boolean);
        if (own.length) return own;
        const cat = row.getAttribute('data-category');
        return coverReady[cat] ? [coverUrl(cat)] : [];
      }

      container.addEventListener('mousemove', (e) => {
        /* En Todo con rejilla de tiles: preview a media pantalla */
        const tile = e.target.closest('.project-tile:not(.github-tile)');
        if (tile && state.filter === 'all') {
          const srcs = (tile.getAttribute('data-imgs') || '').split('|').filter(Boolean);
          if (!srcs.length) {
            const cat = tile.getAttribute('data-category');
            const fallback = coverReady[cat] ? [coverUrl(cat)] : [];
            if (!fallback.length) return hoverCover.hide();
            const r = tile.getBoundingClientRect();
            return hoverCover.show(fallback, (r.left + r.right) / 2 < window.innerWidth / 2);
          }
          const r = tile.getBoundingClientRect();
          return hoverCover.show(srcs, (r.left + r.right) / 2 < window.innerWidth / 2);
        }

        const thumb = e.target.closest('.ix-thumb');
        if (thumb) {
          const fila = marcarFila(thumb.getAttribute('data-id'));
          const srcs = coverSrcsFor(fila);
          if (!srcs.length) return hoverCover.hide();
          const r = thumb.getBoundingClientRect();
          return hoverCover.show(srcs, (r.left + r.right) / 2 < window.innerWidth / 2);
        }

        const row = e.target.closest('.index-row');
        if (!row) {
          marcarFila(null);
          return hoverCover.hide();
        }
        container.querySelectorAll('.index-row.peek').forEach(r => r.classList.remove('peek'));
        syncThumb(row.getAttribute('data-id'));
        const srcs = coverSrcsFor(row);
        if (!srcs.length) return hoverCover.hide();
        const r = row.getBoundingClientRect();
        hoverCover.show(srcs, (r.left + r.right) / 2 < window.innerWidth / 2);
      });
      container.addEventListener('mouseleave', () => { marcarFila(null); hoverCover.hide(); });
      container.addEventListener('click', () => { marcarFila(null); hoverCover.hide(); });
    }

    // Clic en una tarjeta: abrir/cerrar su panel de detalles
    container.addEventListener('click', (e) => {
      const card = e.target.closest(CARD_SEL);
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
      /* En el índice el panel NO va pegado a la fila: la fila vive en una
         columna de 551px y el panel heredaba ese ancho, con las secciones
         apretadas en tiras de 200px donde no se leía nada. Se cuelga del
         grupo de la categoría, que ocupa el ancho completo. En la rejilla
         filtrada sí va pegado a la ficha, que es lo que se espera ahí. */
      const grupo = card.closest('.ix-group');
      if (grupo) grupo.insertAdjacentElement('afterend', panel);
      else card.insertAdjacentElement('afterend', panel);
      openPanel = panel;
      openProjectId = projectId;
      setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    });

    // Teclado: Enter o Espacio abren el panel (accesibilidad)
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest(CARD_SEL);
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
        const card = container.querySelector(`[data-id="${CSS.escape(reopen)}"]`);
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
        const card = container.querySelector(`[data-id="${CSS.escape(reopen)}"]`);
        if (card) card.click();
      }
    });
  } catch (err) {
    console.error('Failed to load projects', err);
    container.innerHTML = '<p style="padding:12px;">Projects could not load. Please serve the site with a local server or open the deployed GitHub Pages site.</p>';
  }
})();

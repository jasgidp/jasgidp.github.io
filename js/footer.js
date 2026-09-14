/*
  ============================================================
  js/footer.js — Pie de página compartido de todo el sitio
  ------------------------------------------------------------
  ¿Qué hace?
  Genera el <footer> y lo inserta donde haya <div id="site-footer">.
  Si una página se olvida del div, lo añade al final del body, igual
  que hace header.js con la cabecera.

  ¿Por qué es "dinámico"?
  - Las redes salen de data/contact.json, no están escritas a mano.
    Así, cambiar tu Instagram o añadir una red nueva se hace en UN
    sitio y aparece en las siete páginas. Si el JSON no carga (abrir
    el HTML con doble clic, sin servidor), el pie se pinta igual sin
    esa fila en vez de quedarse a medias.
  - El año del copyright se calcula, no se escribe: un año fijo se
    queda viejo en enero y nadie se acuerda de tocarlo.
  - Marca el enlace de la página en la que estás.
  - Se traduce con el mismo sistema que el resto (data-i18n) y se
    vuelve a pintar al cambiar de idioma.
  ============================================================
*/
(() => {
  const NAV = [
    { href: 'index.html',     key: 'nav.home',      label: 'Inicio' },
    { href: 'about.html',     key: 'nav.about',     label: 'Sobre mí' },
    { href: 'portfolio.html', key: 'nav.portfolio', label: 'Portafolio' },
    { href: 'skills.html',    key: 'nav.skills',    label: 'Habilidades' },
    { href: 'timeline.html',  key: 'nav.timeline',  label: 'Cronología' },
    { href: 'contact.html',   key: 'nav.contact',   label: 'Contacto' }
  ];

  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Texto que puede venir plano o como {es,en,pt}, igual que en el resto del sitio
  function tx(value, fallback) {
    if (value == null) return fallback || '';
    if (typeof value === 'string') return value;
    const l = document.documentElement.lang || 'es';
    return value[l] || value.en || value.es || fallback || '';
  }

  let contact = null;
  let quotes = [];

  /* CINTA DE FRASES
     Se desliza de derecha a izquierda, muy lenta. La lista se pinta
     DOS veces seguidas y la animación recorre exactamente la mitad del
     ancho: al llegar al final, la segunda copia está justo donde
     empezó la primera, así que el salto de vuelta es invisible y la
     cinta parece infinita. Sin duplicar, se vería el hueco al reiniciar.

     La duración se calcula con el número de frases para que la
     velocidad no cambie al añadir o quitar: unos 9 segundos por frase.

     aria-hidden porque es decoración: un lector de pantalla leyendo
     diez citas en bucle al final de cada página es ruido. */
  function quotesHtml() {
    if (!quotes.length) return '';
    const uno = quotes.map(q => `
      <span class="footer-quote">
        <span class="footer-quote-text">${esc(tx(q.text, ''))}</span>
        <span class="footer-quote-author">${esc(q.author || '')}</span>
      </span>`).join('');
    const segundos = Math.max(60, quotes.length * 9);
    return `
      <div class="footer-quotes" aria-hidden="true">
        <div class="footer-quotes-track" style="--dur:${segundos}s">${uno}${uno}</div>
      </div>`;
  }

  function html() {
    const year = new Date().getFullYear();

    const links = NAV.map(n => {
      const active = n.href.toLowerCase() === current ? ' class="active" aria-current="page"' : '';
      return `<li><a href="${n.href}"${active} data-i18n="${n.key}">${n.label}</a></li>`;
    }).join('');

    const socials = (contact && Array.isArray(contact.socials) ? contact.socials : [])
      .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener me"
                    class="footer-social" aria-label="${esc(s.name)}" title="${esc(s.name)}">
                   <i class="${esc(s.icon)}" aria-hidden="true"></i>
                 </a>`).join('');

    const email = contact && contact.email ? contact.email : '';
    const loc = contact ? tx(contact.location, '') : '';

    return `
      <footer class="site-footer">
        <div class="footer-inner">

          <div class="footer-brand">
            <a href="index.html" class="footer-logo" aria-label="Home">
              <img src="assets/img/brand/HOme.png" alt="JASG">
            </a>
            <p class="footer-tagline" data-i18n="footer.tagline">Ingeniero de Diseño de Producto especialista en desarrollo de software enfocado en streaming.</p>
            ${loc ? `<p class="footer-loc"><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(loc)}</p>` : ''}
          </div>

          <div class="footer-contact">
            ${email ? `<a class="footer-mail" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
            ${socials ? `<div class="footer-socials">${socials}</div>` : ''}
          </div>

        </div>

        <nav class="footer-nav" aria-label="Footer">
          <ul>${links}</ul>
        </nav>

        ${quotesHtml()}

        <div class="footer-bottom">
          <p>© ${year} Jonathan Alejandro Sandoval Guerrero</p>
          <button type="button" class="footer-top" data-i18n-title="footer.backToTop" title="Volver arriba">
            <i class="ri-arrow-up-line" aria-hidden="true"></i>
            <span data-i18n="footer.backToTop">Volver arriba</span>
          </button>
        </div>
      </footer>`;
  }

  function paint() {
    const existing = document.querySelector('.site-footer');
    if (existing) existing.outerHTML = html();
    else {
      const mount = document.getElementById('site-footer');
      if (mount) mount.outerHTML = html();
      else document.body.insertAdjacentHTML('beforeend', html());
    }
    if (window.applyI18n) window.applyI18n(document.querySelector('.site-footer'));
  }

  // Pintamos ya, sin esperar al JSON: el pie no puede depender de una
  // petición de red para existir. Cuando llegue, se repinta con las redes.
  paint();

  /* Las dos peticiones juntas y UN solo repintado: por separado, el pie
     se redibujaba dos veces y la cinta arrancaba su animación desde
     cero en mitad del recorrido. */
  Promise.all([
    fetch('./data/contact.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('./data/quotes.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([c, q]) => {
    if (c) contact = c;
    if (q && Array.isArray(q.quotes)) quotes = q.quotes;
    if (c || q) paint();
  });

  document.addEventListener('i18n:updated', paint);

  // "Volver arriba". Delegado en document porque el pie se repinta y
  // un listener puesto sobre el botón moriría con él.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.footer-top')) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();

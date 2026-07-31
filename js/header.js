/*
  ============================================================
  js/header.js — Menú compartido de todo el sitio
  ------------------------------------------------------------
  ¿Qué hace?
  Genera el HTML del <header> (logo, enlaces, selector de idioma)
  y lo inserta donde haya un <div id="site-header"></div>.

  ¿Por qué?
  Así el menú es idéntico en todas las páginas. Si añades un
  enlace nuevo, lo haces UNA vez aquí y aparece en todo el sitio.

  También marca el enlace de la página actual con class="active"
  para que el usuario sepa dónde está.
  ============================================================
*/
(() => {
  // Lista de páginas del menú: href = archivo, key = clave i18n, label = texto por defecto
  const NAV = [
    { href: 'index.html',     key: 'nav.home',      label: 'Home' },
    { href: 'about.html',     key: 'nav.about',     label: 'About' },
    { href: 'portfolio.html', key: 'nav.portfolio', label: 'Portfolio' },
    { href: 'skills.html',    key: 'nav.skills',    label: 'Skills' },
    { href: 'timeline.html',  key: 'nav.timeline',  label: 'Timeline' },
    { href: 'contact.html',   key: 'nav.contact',   label: 'Contact' }
  ];

  // Nombre del archivo actual (ej. "about.html"). Si estamos en "/", usamos index.html
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // Plantilla HTML del header completo
  const headerHTML = `
    <header class="header">
      <!-- Logo: vuelve al inicio -->
      <a href="index.html" class="logo" aria-label="Home"><img src="assets/img/brand/HOme.png" alt="JASG logo"></a>

      <!--
        Icono de menú hamburguesa (solo visible en móvil vía CSS).
        role="button" + tabindex permiten abrirlo con teclado.
      -->
      <i class="ri-menu-line" id="menu-icon" role="button" tabindex="0"
         aria-label="Toggle navigation" aria-expanded="false" aria-controls="primary-nav"></i>

      <!-- Lista de enlaces de navegación -->
      <ul class="navlist" id="primary-nav">
        ${NAV.map(n => {
          // Si este enlace es la página actual, le añadimos "active"
          const active = n.href.toLowerCase() === current ? ' class="active" aria-current="page"' : '';
          return `<li><a href="${n.href}" data-i18n="${n.key}"${active}>${n.label}</a></li>`;
        }).join('')}
      </ul>

      <!-- Acciones del header: tema + idioma -->
      <div class="header-actions">
        <!--
          Botón de modo claro/oscuro. js/theme.js escucha los clics
          en [data-theme-toggle] y le pone el icono correcto (sol o luna).
        -->
        <button class="theme-toggle" data-theme-toggle type="button"
                aria-pressed="false" aria-label="Cambiar tema" title="Cambiar tema">
          <i class="ri-moon-line" aria-hidden="true"></i>
        </button>

        <!-- Botones de idioma: i18n.js escucha los clics en [data-lang] -->
        <div class="lang-switcher">
          <button data-lang="es" aria-label="Cambiar a español">ES</button>
          <button data-lang="en" aria-label="Switch to English">EN</button>
          <button data-lang="pt" aria-label="Mudar para português">PT</button>
        </div>
      </div>
    </header>`;

  // Insertamos el header en el punto de montaje
  const mount = document.getElementById('site-header');
  if (mount) {
    // Reemplazamos el div vacío por el <header> real
    mount.outerHTML = headerHTML;
  } else {
    // Si alguna página olvidó el div, lo añadimos al inicio del body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
  }
})();

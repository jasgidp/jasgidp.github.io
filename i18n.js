/*
  ============================================================
  i18n.js — Internacionalización (traducciones ES / EN / PT)
  ------------------------------------------------------------
  ¿Qué hace?
  - Carga el archivo locales/es.json (o en.json / pt.json).
  - Busca en el HTML todos los elementos con data-i18n="clave"
    y reemplaza su texto por la traducción correspondiente.
  - Recuerda el idioma elegido en localStorage.
  - Avisa al resto de la app con el evento "i18n:updated".

  ¿Por qué?
  Para que el sitio hable español, inglés o portugués sin
  duplicar páginas HTML enteras.

  Cómo usarlo en HTML:
    <span data-i18n="nav.home">Home</span>
  Esa clave "nav.home" debe existir en locales/*.json.
  ============================================================
*/
(() => {
  // Idioma por defecto: el último que guardó el usuario, o español
  const DEFAULT_LANG = localStorage.getItem('lang') || 'es';
  const supported = ['es', 'en', 'pt']; // idiomas permitidos
  let currentDict = null; // diccionario JSON del idioma actual

  // Navega por un objeto con una ruta tipo "hero.ctaCV"
  // Ejemplo: getValueByPath({ hero: { ctaCV: "X" } }, "hero.ctaCV") → "X"
  function getValueByPath(obj, path) {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
  }

  // Recorre el HTML y aplica las traducciones a cada [data-i18n]
  function applyI18n(root = document) {
    if (!currentDict) return;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const txt = getValueByPath(currentDict, key);
      // Solo cambiamos el texto si encontramos una cadena válida
      if (typeof txt === 'string') el.textContent = txt;
    });
  }

  // Exponemos funciones globales para que otros scripts (projects.js, etc.)
  // puedan traducir contenido que crean dinámicamente.
  window.applyI18n = applyI18n;
  window.t = function(key, fallback = '') {
    if (!currentDict) return fallback || key;
    const val = getValueByPath(currentDict, key);
    return typeof val === 'string' ? val : (fallback || key);
  };

  // Descarga el JSON del idioma, lo aplica y lo guarda
  async function loadLocale(lang) {
    if (!supported.includes(lang)) lang = 'es'; // fallback seguro
    const res = await fetch(`./locales/${lang}.json`);
    if (!res.ok) return; // si falla la red, no rompemos la página
    currentDict = await res.json();
    document.documentElement.lang = lang; // actualiza <html lang="...">

    applyI18n(document);

    localStorage.setItem('lang', lang); // recordar preferencia
    // Avisa a otros scripts: "el idioma cambió, re-renderiza si hace falta"
    document.dispatchEvent(new CustomEvent('i18n:updated', { detail: { lang } }));
  }

  // Clics en botones ES / EN / PT (tienen data-lang="es|en|pt")
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (btn) {
      e.preventDefault();
      loadLocale(btn.getAttribute('data-lang'));
    }
  });

  // Arranque: cargar el idioma por defecto
  loadLocale(DEFAULT_LANG).catch(console.error);
})();

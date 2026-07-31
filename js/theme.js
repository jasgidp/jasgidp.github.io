/*
  ============================================================
  js/theme.js — Modo claro / oscuro
  ------------------------------------------------------------
  ¿Qué hace?
  Decide si la página se ve clara u oscura y lo recuerda.

  ¿Cómo?
  Pone el atributo data-theme="dark" en la etiqueta <html>.
  El CSS (css/main.css) tiene un bloque [data-theme="dark"]
  que redefine todos los colores, así que con ese atributo
  cambia el sitio completo de golpe.

  Orden de preferencia:
  1) Lo que el usuario eligió antes (guardado en localStorage).
  2) Si nunca eligió: lo que prefiera su sistema operativo.

  ¿Por qué se carga en el <head> SIN "defer"?
  Para que el tema se aplique ANTES de dibujar la página.
  Si se cargara al final, se vería un parpadeo blanco antes
  de pasar a oscuro (el clásico "flash of wrong theme").
  ============================================================
*/
(() => {
  const STORAGE_KEY = 'theme'; // clave en localStorage
  const DARK = 'dark';
  const LIGHT = 'light';

  // ¿El sistema del usuario está en modo oscuro?
  const systemPrefersDark = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Lee la preferencia guardada (o null si nunca eligió)
  const stored = () => {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  };

  // Tema que toca mostrar ahora mismo
  const resolve = () => stored() || (systemPrefersDark() ? DARK : LIGHT);

  // Aplica el tema al documento y actualiza los botones
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Color de la barra del navegador en móvil (Chrome/Safari)
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === DARK ? '#0b1220' : '#ffffff';

    syncButtons(theme);
  }

  // Pone el icono correcto y el estado accesible en los botones de tema
  function syncButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const isDark = theme === DARK;
      // Sol cuando está oscuro (para "volver a claro") y luna al contrario
      const icon = btn.querySelector('i');
      if (icon) icon.className = isDark ? 'ri-sun-line' : 'ri-moon-line';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
    });
  }

  // Cambia al tema opuesto y lo guarda como decisión explícita
  function toggle() {
    const next = document.documentElement.getAttribute('data-theme') === DARK ? LIGHT : DARK;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    apply(next);
  }

  // --- Aplicar cuanto antes, incluso antes de que exista el <body> ---
  apply(resolve());

  // Los botones los crea js/header.js después, así que escuchamos
  // los clics en todo el documento (delegación de eventos).
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) {
      e.preventDefault();
      toggle();
    }
  });

  // Cuando el HTML termina de cargar, sincronizamos los botones ya creados
  document.addEventListener('DOMContentLoaded', () => syncButtons(resolve()));

  // Si el usuario cambia el tema de su sistema y nunca eligió manualmente,
  // seguimos al sistema.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!stored()) apply(e.matches ? DARK : LIGHT);
    });
  }

  // Por si otro script necesita saber o cambiar el tema
  window.Theme = { apply, toggle, current: () => document.documentElement.getAttribute('data-theme') };
})();

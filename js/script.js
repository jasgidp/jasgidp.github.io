/*
  ============================================================
  script.js — Utilidades compartidas en casi todas las páginas
  ------------------------------------------------------------
  ¿Qué hace este archivo?
  1) Mostrar/ocultar el demo (iframe) en la página de Programación.
  2) Abrir/cerrar el menú hamburguesa en móviles.
  3) Animar el hero al cargar (ScrollReveal), si la librería existe.

  ¿Por qué está aquí?
  Porque estas 3 cosas se usan en varias páginas y conviene
  tenerlas en un solo archivo en vez de copiarlas en cada HTML.
  ============================================================
*/

/* ------------------------------------------------------------
   1) TOGGLE DEL DEMO EN VIVO (página Programming)
   Cuando alguien hace clic en el botón ".toggle-preview",
   buscamos el iframe hermano y lo mostramos u ocultamos.
   También cambiamos el texto del botón (Show demo / Hide demo).
   ------------------------------------------------------------ */
document.addEventListener('click', (e) => {
  // ¿El clic fue sobre (o dentro de) un botón de preview?
  const btn = e.target.closest('.toggle-preview');
  if (!btn) return; // Si no, no hacemos nada

  // Subimos al contenedor del proyecto (.project-item)
  const item = btn.closest('.project-item');
  if (!item) return;

  // Dentro de ese proyecto buscamos el iframe del demo
  const iframe = item.querySelector('iframe.iframe');
  if (!iframe) return;

  // Si ya se ve (display:block), lo ocultamos; si no, lo mostramos
  const isVisible = iframe.style.display === 'block';
  iframe.style.display = isVisible ? 'none' : 'block';

  // Actualizamos la etiqueta del botón según el idioma actual
  const label = btn.querySelector('[data-i18n="programming.preview"]');
  if (label) label.textContent = isVisible
    ? (window.t ? window.t('programming.preview', 'Show demo') : 'Show demo')
    : (window.t ? window.t('programming.hide', 'Hide demo') : 'Hide demo');
});

/* ------------------------------------------------------------
   2) MENÚ MÓVIL (hamburguesa)
   En pantallas pequeñas el menú está oculto a la derecha.
   Al tocar el icono #menu-icon se abre/cierra (clase "open").
   Usamos una función auto-ejecutada (()=>{...})() para no
   contaminar el espacio global con variables temporales.
   ------------------------------------------------------------ */
(() => {
  const menu = document.querySelector('#menu-icon');   // icono ☰ / ✕
  const navlist = document.querySelector('.navlist');  // lista de enlaces
  // Si esta página no tiene menú, salimos sin error
  if (!menu || !navlist) return;

  // Cambia el icono: menú abierto = X, cerrado = hamburguesa
  const setIcon = (isOpen) => {
    menu.classList.toggle('ri-close-line', isOpen);
    menu.classList.toggle('ri-menu-line', !isOpen);
  };

  // Cierra el menú y restaura el estado accesible
  const closeMenu = () => {
    navlist.classList.remove('open');
    setIcon(false);
    menu.setAttribute('aria-expanded', 'false'); // para lectores de pantalla
    document.body.classList.remove('menu-open');  // por si CSS bloquea el scroll
  };

  // Alterna abierto/cerrado
  const toggleMenu = () => {
    const isOpen = navlist.classList.toggle('open');
    setIcon(isOpen);
    menu.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
  };

  // Clic en el icono
  menu.addEventListener('click', toggleMenu);

  // Teclado: Enter o Espacio también abren/cierran (accesibilidad)
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
  });

  // Si eliges un enlace del menú, lo cerramos (mejor UX en móvil)
  navlist.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });

  // Tecla Escape cierra el menú
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
})();

/* ------------------------------------------------------------
   NOTA SOBRE LAS ANIMACIONES
   Antes aquí se usaba la librería ScrollReveal (descargada de
   internet) solo para animar dos elementos del hero.

   Ahora esas animaciones están en css/main.css:
   - la entrada del hero con @keyframes
   - las apariciones al bajar con animation-timeline: view()

   Hacerlo en CSS ahorra una descarga externa y el navegador lo
   ejecuta de forma más eficiente que con JavaScript.
   ------------------------------------------------------------ */

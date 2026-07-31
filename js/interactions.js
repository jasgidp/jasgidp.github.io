/*
  ============================================================
  js/interactions.js — Micro-interacciones del cursor
  ------------------------------------------------------------
  ¿Qué hace?
  Cuando mueves el ratón por encima de una tarjeta, un brillo
  suave la sigue (efecto "spotlight" o foco de luz).

  ¿Cómo funciona?
  El CSS ya tiene el degradado dibujado, pero su posición
  depende de dos variables: --mx (horizontal) y --my (vertical).
  Este archivo solo se encarga de actualizar esas dos variables
  con la posición del cursor. Todo el dibujo lo hace el CSS.

  ¿Por qué así?
  Porque mover un degradado con variables CSS es muy barato para
  el navegador. Si en vez de eso creáramos y moviéramos elementos
  con JavaScript, el efecto se sentiría lento.

  Detalles de rendimiento:
  - Un solo listener en todo el documento (delegación), en lugar
    de uno por tarjeta. Da igual si hay 5 o 500 tarjetas.
  - requestAnimationFrame: agrupa las actualizaciones para que
    ocurran una vez por fotograma, no en cada píxel movido.
  - Se desactiva si el sistema pide menos movimiento, y en
    pantallas táctiles (donde no hay cursor que seguir).
  ============================================================
*/
(() => {
  // Tarjetas que reaccionan al cursor. Deben tener la clase o el
  // estilo .spotlight-target en css/main.css.
  const SELECTOR = [
    '.skill-card',
    '.timeline-card',
    '.repo-card',
    '.glass-card',
    '.fact',
    '.project-tile',
    '.prog-card'
  ].join(',');

  // ¿El usuario pidió menos animaciones en su sistema? Lo respetamos.
  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ¿Hay un cursor real? En móvil no tiene sentido seguir el dedo.
  const hasFinePointer = window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (reduceMotion || !hasFinePointer) return;

  let pending = null;   // datos del último movimiento, esperando su turno
  let frame = null;     // id del fotograma pedido

  // Escribe las variables CSS. Se ejecuta una vez por fotograma.
  function paint() {
    frame = null;
    if (!pending) return;
    const { card, x, y } = pending;
    card.style.setProperty('--mx', x + 'px');
    card.style.setProperty('--my', y + 'px');
    pending = null;
  }

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest(SELECTOR);
    if (!card) return;

    // Posición del cursor relativa a la esquina de la tarjeta
    const r = card.getBoundingClientRect();
    pending = { card, x: e.clientX - r.left, y: e.clientY - r.top };

    // Pedimos un hueco en el próximo fotograma (si no lo pedimos ya)
    if (frame === null) frame = requestAnimationFrame(paint);
  }, { passive: true });
})();

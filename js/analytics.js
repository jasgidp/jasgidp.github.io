/*
  ============================================================
  analytics.js — Google Analytics (medición de visitas)
  ------------------------------------------------------------
  ¿Qué hace?
  Inserta el script oficial de Google (gtag) y configura tu
  propiedad de Analytics con el ID G-29TMGRLTZK.

  ¿Por qué un archivo aparte?
  Para incluirlo en todas las páginas públicas con una sola
  línea y no pegar el mismo bloque en cada HTML.

  Nota: solo debe usarse en páginas públicas, no en admin.html
  (el panel privado no necesita medir visitas).
  ============================================================
*/
(() => {
  const ID = 'G-29TMGRLTZK'; // ID de tu propiedad de Google Analytics

  // Creamos una etiqueta <script> que descarga gtag.js de Google
  const s = document.createElement('script');
  s.async = true; // no bloquea el resto de la página
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  // Cola de eventos que gtag procesará cuando el script esté listo
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // Inicialización estándar recomendada por Google
  gtag('js', new Date());
  gtag('config', ID);
})();

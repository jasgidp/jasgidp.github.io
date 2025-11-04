(() => {
  const DEFAULT_LANG = localStorage.getItem('lang') || 'es';
  const supported = ['es', 'en', 'pt'];
  let currentDict = null;

  function getValueByPath(obj, path) {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
  }

  function applyI18n(root = document) {
    if (!currentDict) return;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const txt = getValueByPath(currentDict, key);
      if (typeof txt === 'string') el.textContent = txt;
    });
  }
  // expose for dynamic content
  window.applyI18n = applyI18n;
  window.t = function(key, fallback = '') {
    if (!currentDict) return fallback || key;
    const val = getValueByPath(currentDict, key);
    return typeof val === 'string' ? val : (fallback || key);
  };

  async function loadLocale(lang) {
    if (!supported.includes(lang)) lang = 'es';
    const res = await fetch(`./locales/${lang}.json`);
    if (!res.ok) return;
    currentDict = await res.json();
    document.documentElement.lang = lang;

    applyI18n(document);

    localStorage.setItem('lang', lang);
    document.dispatchEvent(new CustomEvent('i18n:updated', { detail: { lang } }));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (btn) {
      e.preventDefault();
      loadLocale(btn.getAttribute('data-lang'));
    }
  });

  // Init
  loadLocale(DEFAULT_LANG).catch(console.error);
})();

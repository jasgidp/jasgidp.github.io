/*
  ============================================================
  github-repos.js — Lista automática de repos públicos de GitHub
  ------------------------------------------------------------
  ¿Qué hace?
  - Pide a la API pública de GitHub los repos del usuario jasgidp.
  - Filtra según data/repos-config.json (ocultar forks, excluir nombres…).
  - Dibuja tarjetas en #github-repos.
  - Guarda resultado 1 hora en localStorage (caché) para no
    agotar el límite de 60 peticiones/hora sin autenticación.
  - Si GitHub falla pero hay caché, muestra datos antiguos.

  ¿Por qué?
  Así la sección de repos se actualiza sola cuando creas un repo
  nuevo, sin editar el HTML a mano.
  ============================================================
*/
(async () => {
  const mount = document.getElementById('github-repos');
  if (!mount) return; // solo corre en programming.html

  const USER = 'jasgidp';
  const CACHE_KEY = 'gh_repos_cache_v1';
  const TTL = 60 * 60 * 1000; // 1 hora en milisegundos

  const t = (key, fallback) => (window.t ? window.t(key, fallback) : fallback);

  // Leer / escribir caché en el navegador
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }
  function writeCache(repos) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), repos })); } catch (_) {}
  }

  // Config opcional: qué repos ocultar / destacar
  async function loadConfig() {
    try {
      const res = await fetch('./data/repos-config.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw 0;
      return await res.json();
    } catch (_) {
      // Valores por defecto si no existe el archivo
      return { hideForks: true, hideArchived: false, exclude: [], featured: [] };
    }
  }

  // Descarga hasta 3 páginas de 100 repos (máximo 300)
  async function fetchRepos() {
    const all = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&page=${page}`);
      if (!res.ok) {
        const remaining = res.headers.get('X-RateLimit-Remaining');
        throw new Error(remaining === '0' ? 'rate-limit' : 'HTTP ' + res.status);
      }
      const batch = await res.json();
      all.push(...batch);
      if (batch.length < 100) break; // última página
    }
    return all;
  }

  // Aplica filtros y orden (featured primero, luego por fecha)
  function applyConfig(repos, cfg) {
    const exclude = new Set((cfg.exclude || []).map(s => s.toLowerCase()));
    const featured = (cfg.featured || []).map(s => s.toLowerCase());
    let list = repos.filter(r => {
      if (exclude.has(r.name.toLowerCase())) return false;
      if (cfg.hideForks && r.fork) return false;
      if (cfg.hideArchived && r.archived) return false;
      return true;
    });
    list.sort((a, b) => {
      const ai = featured.indexOf(a.name.toLowerCase());
      const bi = featured.indexOf(b.name.toLowerCase());
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });
    return list;
  }

  // Fecha legible según el idioma de la página
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(document.documentElement.lang || 'es', { year: 'numeric', month: 'short' }); }
    catch (_) { return ''; }
  }

  // HTML de una tarjeta de repositorio
  function repoCard(r) {
    const demo = r.homepage && r.homepage.trim();
    return `
      <article class="repo-card" data-category="engineering">
        <div class="repo-card-head">
          <h3><a href="${r.html_url}" target="_blank" rel="noopener">${r.name}</a></h3>
          ${r.stargazers_count ? `<span class="repo-stars"><i class="ri-star-line" aria-hidden="true"></i>${r.stargazers_count}</span>` : ''}
        </div>
        <p class="repo-desc">${r.description ? r.description.replace(/</g, '&lt;') : '<span class="admin-subtle">—</span>'}</p>
        <div class="repo-meta">
          ${r.language ? `<span class="repo-lang"><span class="repo-dot"></span>${r.language}</span>` : ''}
          <span class="repo-updated"><i class="ri-history-line" aria-hidden="true"></i>${fmtDate(r.pushed_at)}</span>
        </div>
        <div class="repo-links">
          <a class="btn" href="${r.html_url}" target="_blank" rel="noopener"><i class="ri-github-fill" aria-hidden="true"></i>${t('programming.repo', 'Repo')}</a>
          ${demo ? `<a class="btn orange" href="${r.homepage}" target="_blank" rel="noopener"><i class="ri-external-link-line" aria-hidden="true"></i>Demo</a>` : ''}
        </div>
      </article>`;
  }

  function render(repos, stale) {
    if (!repos.length) { mount.innerHTML = '<p class="empty-state">No public repositories found.</p>'; return; }
    mount.innerHTML = repos.map(repoCard).join('') +
      (stale ? '<p class="admin-subtle" style="grid-column:1/-1;text-align:center">Mostrando datos en caché (GitHub no disponible ahora).</p>' : '');
  }

  // Estado de carga mientras pedimos datos
  mount.innerHTML = '<p class="empty-state">Cargando repositorios…</p>';

  const cfg = await loadConfig();
  const cache = readCache();

  // Si la caché es fresca (< 1 h), la usamos y no llamamos a GitHub
  if (cache && (Date.now() - cache.ts) < TTL) {
    render(applyConfig(cache.repos, cfg), false);
    return;
  }

  try {
    const repos = await fetchRepos();
    writeCache(repos);
    render(applyConfig(repos, cfg), false);
  } catch (err) {
    // Fallback: caché vieja, o mensaje de error
    if (cache) { render(applyConfig(cache.repos, cfg), true); }
    else {
      mount.innerHTML = `<p class="empty-state">${err.message === 'rate-limit'
        ? 'Límite de peticiones de GitHub alcanzado. Intenta de nuevo en unos minutos.'
        : 'No se pudieron cargar los repositorios.'}</p>`;
    }
  }
})();

/*
  ============================================================
  github-api.js — Ayudante para hablar con la API de GitHub
  ------------------------------------------------------------
  ¿Qué hace?
  Expone window.GitHubAPI con funciones para:
  - Guardar / leer / borrar el token (localStorage).
  - Validar quién eres (getUser).
  - Leer metadatos/sha de un archivo (getFileMeta).
  - Leer un archivo del repo (getFile).
  - Crear/actualizar un archivo de texto/JSON (putFile).
  - Subir una imagen en base64 (putBinary).

  ¿Por qué?
  El panel admin/ necesita leer y escribir los JSON del
  repositorio sin meter secretos en el código. El token vive
  solo en el navegador del administrador.

  No se usa en las páginas públicas del portafolio.
  ============================================================
*/
(() => {
  const OWNER = 'jasgidp';
  const REPO = 'jasgidp.github.io';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'gh_admin_token';

  // UTF-8 seguro para acentos/emojis
  const encodeB64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const decodeB64 = (b64) => decodeURIComponent(escape(atob((b64 || '').replace(/\n/g, ''))));

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, (t || '').trim()); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  function hasToken() { return !!getToken(); }

  // Cabeceras mínimas (sin Cache-Control: evita preflight CORS extra)
  function headers(extra = {}) {
    return {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra
    };
  }

  // "Failed to fetch" casi siempre es red/CORS/bloqueador, no un 403 de GitHub
  function networkError(err, path) {
    const msg = (err && err.message) || String(err);
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) {
      return new Error(
        `No se pudo conectar con api.github.com (${path}). ` +
        `Abre el admin desde https://jasgidp.github.io/admin/ (no como archivo local), ` +
        `usa un token fine-grained con Contents: Read and write en ${OWNER}/${REPO}, ` +
        `y permite api.github.com si tienes un bloqueador. Detalle: ${msg}`
      );
    }
    return err instanceof Error ? err : new Error(msg);
  }

  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        ...options,
        mode: 'cors',
        headers: headers(options.headers || {})
      });
    } catch (err) {
      throw networkError(err, path);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (_) {}
      if (res.status === 401) {
        throw new Error('Token inválido o expirado (401). Crea uno nuevo en GitHub → Settings → Developer settings.');
      }
      if (res.status === 403 || res.status === 404) {
        throw new Error(
          `GitHub ${res.status}: ${detail || res.statusText}. ` +
          `El token necesita Contents: Read and write y el repo ${OWNER}/${REPO} seleccionado.`
        );
      }
      throw new Error(`GitHub API ${res.status}: ${detail || res.statusText}`);
    }
    return res.json();
  }

  async function getUser() {
    return request('/user');
  }

  // Solo sha/metadatos (más ligero; útil cuando el contenido ya lo tenemos del sitio)
  async function getFileMeta(filePath) {
    const info = await request(
      `/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}?ref=${BRANCH}&t=${Date.now()}`
    );
    return { sha: info.sha, path: info.path, size: info.size };
  }

  async function getFile(filePath, { parseJson = true } = {}) {
    const info = await request(
      `/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}?ref=${BRANCH}&t=${Date.now()}`
    );
    let text;
    if (info.content) {
      text = decodeB64(info.content);
    } else if (info.download_url) {
      // Archivos grandes: GitHub omite content y da download_url
      let raw;
      try {
        raw = await fetch(info.download_url, { mode: 'cors' });
      } catch (err) {
        throw networkError(err, info.download_url);
      }
      if (!raw.ok) throw new Error(`No se pudo descargar ${filePath} (${raw.status})`);
      text = await raw.text();
    } else {
      throw new Error(`GitHub no devolvió contenido para ${filePath}`);
    }
    return { data: parseJson ? JSON.parse(text) : text, sha: info.sha, text };
  }

  async function putFile(filePath, content, message, sha) {
    const text = typeof content === 'string' ? content : (JSON.stringify(content, null, 2) + '\n');
    const body = {
      message: message || `Update ${filePath}`,
      content: encodeB64(text),
      branch: BRANCH
    };
    if (sha) body.sha = sha;
    return request(`/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function putBinary(filePath, base64, message, sha) {
    const body = { message: message || `Add ${filePath}`, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    return request(`/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  window.GitHubAPI = {
    OWNER, REPO, BRANCH,
    getToken, setToken, clearToken, hasToken,
    getUser, getFileMeta, getFile, putFile, putBinary
  };
})();

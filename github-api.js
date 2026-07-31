/*
  ============================================================
  github-api.js — Ayudante para hablar con la API de GitHub
  ------------------------------------------------------------
  ¿Qué hace?
  Expone window.GitHubAPI con funciones para:
  - Guardar / leer / borrar el token (localStorage).
  - Validar quién eres (getUser).
  - Leer un archivo del repo (getFile).
  - Crear/actualizar un archivo de texto/JSON (putFile).
  - Subir una imagen en base64 (putBinary).

  ¿Por qué?
  El panel admin.html necesita leer y escribir los JSON del
  repositorio sin meter secretos en el código. El token vive
  solo en el navegador del administrador.

  No se usa en las páginas públicas del portafolio.
  ============================================================
*/
(() => {
  // Datos fijos del repositorio donde vive este sitio
  const OWNER = 'jasgidp';
  const REPO = 'jasgidp.github.io';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'gh_admin_token'; // clave en localStorage

  // GitHub pide el contenido en base64. Estas funciones manejan
  // acentos y emojis correctamente (UTF-8).
  const encodeB64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const decodeB64 = (b64) => decodeURIComponent(escape(atob((b64 || '').replace(/\n/g, ''))));

  // CRUD del token en el navegador (nunca se sube al repo)
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, (t || '').trim()); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  function hasToken() { return !!getToken(); }

  // Cabeceras que exige la API de GitHub (autenticación + versión)
  function headers() {
    return {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  // Petición genérica: si falla, lanza un Error con el mensaje de GitHub
  async function request(path, options = {}) {
    const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (_) {}
      throw new Error(`GitHub API ${res.status}: ${detail || res.statusText}`);
    }
    return res.json();
  }

  // ¿El token es válido? Devuelve el usuario autenticado
  async function getUser() {
    return request('/user');
  }

  // Lee un archivo del repo. Devuelve { data, sha, text }.
  // "sha" hace falta al guardar (GitHub lo usa para evitar conflictos).
  async function getFile(filePath, { parseJson = true } = {}) {
    const info = await request(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}&t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    const text = decodeB64(info.content);
    return { data: parseJson ? JSON.parse(text) : text, sha: info.sha, text };
  }

  // Crea o actualiza un archivo de texto/JSON
  async function putFile(filePath, content, message, sha) {
    const text = typeof content === 'string' ? content : (JSON.stringify(content, null, 2) + '\n');
    const body = {
      message: message || `Update ${filePath}`, // mensaje del commit
      content: encodeB64(text),
      branch: BRANCH
    };
    if (sha) body.sha = sha; // si existe el archivo, GitHub exige el sha actual
    return request(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  // Sube un binario ya codificado en base64 (sin el prefijo data:image/...)
  async function putBinary(filePath, base64, message, sha) {
    const body = { message: message || `Add ${filePath}`, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    return request(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  // Hacemos públicas estas funciones para que admin.js las use
  window.GitHubAPI = {
    OWNER, REPO, BRANCH,
    getToken, setToken, clearToken, hasToken,
    getUser, getFile, putFile, putBinary
  };
})();

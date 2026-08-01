/*
  ============================================================
  admin.js — Panel de edición del portafolio
  ------------------------------------------------------------
  ¿Qué es?
  La "aplicación" del admin/. Permite editar los JSON del
  sitio (cronología, skills, proyectos, código) y guardarlos
  en GitHub con un token personal.

  Flujo general:
  1) Login (token) o Preview local (solo lectura).
  2) Elegir pestaña → se renderiza un editor de formularios.
  3) Al cambiar un campo se marca "dirty" (cambios sin guardar).
  4) "Guardar en GitHub" escribe el archivo vía GitHubAPI.

  Depende de: github-api.js (debe cargarse antes).
  ============================================================
*/

(() => {
  // Acceso al helper de GitHub (definido en github-api.js)
  const G = window.GitHubAPI;

  // Qué archivo JSON edita cada pestaña del admin
  const FILES = {
    timeline: 'data/timeline.json',
    skills:   'data/skills.json',
    projects: 'data/projects.json',
    code:     'data/code-projects.json'
  };

  // store[tab] = { data: objeto JSON, sha: versión en GitHub }
  const store = { timeline: null, skills: null, projects: null, code: null };
  // dirty[tab] = true si hay cambios sin guardar en esa pestaña
  const dirty = { timeline: false, skills: false, projects: false, code: false };
  let activeTab = 'timeline';           // pestaña visible ahora
  let timelineSection = 'experience';  // sub-sección de la cronología
  let previewMode = false;             // true = solo lectura (sin token)

  // Sub-secciones de la cronología
  const TL_SECTIONS = [
    { key: 'experience', label: 'Experiencia' },
    { key: 'research',   label: 'Investigación' },
    { key: 'leadership', label: 'Liderazgo' },
    { key: 'education',  label: 'Educación' }
  ];
  // Categorías válidas de un proyecto del portafolio
  const CATEGORIES = ['graphic', 'experience', 'engineering', 'research', 'software', 'design'];

  // Atajo: $('save-btn') ≡ document.getElementById('save-btn')
  const $ = (id) => document.getElementById(id);

  /* ============================================================
     HELPERS (utilidades pequeñas reutilizadas en todos los editores)
     - esc: escapa HTML para que un título con < no rompa la página
     - joinLines / toLines: array ↔ textarea (una línea por ítem)
     - joinCsv / toCsv: array ↔ input separado por comas
     - slugify: convierte un título en id tipo "mi-proyecto"
     ============================================================ */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const joinLines = (arr) => (Array.isArray(arr) ? arr : []).join('\n');
  const toLines = (v) => (v || '').split('\n').map(s => s.trim()).filter(Boolean);
  const joinCsv = (arr) => (Array.isArray(arr) ? arr : (arr ? [arr] : [])).join(', ');
  const toCsv = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
  const slugify = (s) => (s || 'item').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

  function setStatus(el, msg, kind) {
    el.textContent = msg || '';
    el.className = 'admin-status' + (kind ? ' ' + kind : '');
  }
  function markDirty() { if (previewMode) return; dirty[activeTab] = true; updateSaveState(); }
  // Actualiza solo el botón Guardar. NO pisa mensajes de éxito/error del save.
  function updateSaveState() {
    const btn = $('save-btn');
    if (previewMode) {
      btn.disabled = true;
      const st = $('save-status');
      if (!st.classList.contains('success') && !st.classList.contains('error')) {
        setStatus(st, 'Modo preview: inicia sesión para guardar', 'working');
      }
      return;
    }
    btn.disabled = !dirty[activeTab] || !store[activeTab];
    const st = $('save-status');
    // Solo muestra "Cambios sin guardar" si no hay un mensaje final de save
    if (dirty[activeTab] && !st.classList.contains('success') && !st.classList.contains('error')) {
      setStatus(st, 'Cambios sin guardar', 'working');
    }
  }

  // Read-only preview using the deployed/local JSON (no token needed)
  async function previewLocal() {
    previewMode = true;
    try {
      for (const key of Object.keys(FILES)) {
        const res = await fetch('../' + FILES[key] + '?t=' + Date.now(), { cache: 'no-store' });
        store[key] = { data: await res.json(), sha: null };
      }
      normalizeProjects();
      $('whoami').textContent = '(preview local · solo lectura)';
      showPanel();
      renderActive();
    } catch (err) {
      setStatus($('login-status'), 'No se pudo cargar en preview: ' + err.message, 'error');
    }
  }

  /* ============================================================
     LOGIN
     1) Intenta validar el token con GitHub (/user).
     2) Si la red/CORS falla pero el token tiene forma válida,
        entra igual, carga datos locales y deja guardar después.
     3) Si el token es de otro usuario → rechazo.
     ============================================================ */
  function looksLikeToken(t) {
    return /^(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]+/.test((t || '').trim());
  }

  async function tryLogin(token) {
    previewMode = false;
    G.setToken(token);
    showLogin(); // por si fallamos a mitad, el mensaje se ve en el login
    setStatus($('login-status'), 'Validando token…', 'working');

    let user = null;
    try {
      user = await G.getUser();
    } catch (err) {
      // Red/CORS: no bloqueamos el panel; los datos salen del sitio
      if (looksLikeToken(token) && /api\.github\.com|Failed to fetch|NetworkError|Load failed|CORS/i.test(err.message)) {
        $('whoami').textContent = '(token guardado · API no respondió al validar)';
        showPanel();
        await loadAll();
        setStatus(
          $('save-status'),
          'No se pudo validar el token contra GitHub ahora. Puedes editar; al Guardar se reintentará. ' + err.message,
          'working'
        );
        return;
      }
      setStatus($('login-status'), 'Token inválido o sin permisos: ' + err.message, 'error');
      G.clearToken();
      showLogin();
      return;
    }

    if (user.login && user.login.toLowerCase() !== G.OWNER.toLowerCase()) {
      setStatus($('login-status'),
        `Token de @${user.login}. Necesitas un token de @${G.OWNER} con escritura en el repo.`, 'error');
      G.clearToken();
      showLogin();
      return;
    }

    $('whoami').textContent = `@${user.login}`;
    setStatus($('login-status'), '', '');
    showPanel();
    await loadAll();
  }

  function showLogin() { $('login-view').hidden = false; $('panel-view').hidden = true; }
  function showPanel() { $('login-view').hidden = true; $('panel-view').hidden = false; }

  /* ============================================================
     CARGA DE DATOS (híbrida)
     1) El contenido se lee del sitio desplegado (./data/*.json),
        igual que el preview → siempre funciona en GitHub Pages.
     2) El "sha" se pide a la API de GitHub (hace falta para Guardar).
     Así un fallo de red/CORS al bajar el JSON no deja el panel vacío.
     ============================================================ */
  async function loadLocalFiles() {
    for (const key of Object.keys(FILES)) {
      const res = await fetch('../' + FILES[key] + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`No se pudo leer ${FILES[key]} (${res.status})`);
      store[key] = { data: await res.json(), sha: store[key]?.sha || null };
    }
  }

  async function loadShasFromGitHub() {
    const errors = [];
    // En paralelo (más rápido) y sin tumbar la UI si uno falla
    await Promise.all(Object.keys(FILES).map(async (key) => {
      try {
        const meta = await G.getFileMeta(FILES[key]);
        if (store[key]) store[key].sha = meta.sha;
      } catch (err) {
        errors.push(`${FILES[key]}: ${err.message}`);
      }
    }));
    return errors;
  }

  async function loadAll() {
    setStatus($('save-status'), 'Cargando datos…', 'working');
    try {
      await loadLocalFiles();
      normalizeProjects();
      renderActive();

      // Los sha se piden en segundo plano; la UI ya es usable
      const shaErrors = await loadShasFromGitHub();
      if (shaErrors.length === Object.keys(FILES).length) {
        setStatus(
          $('save-status'),
          'Datos listos. GitHub no devolvió sha ahora; al Guardar se pedirá de nuevo. ' + shaErrors[0],
          'working'
        );
      } else if (shaErrors.length) {
        setStatus($('save-status'), 'Datos listos (algunos sha pendientes). ' + shaErrors[0], 'working');
      } else {
        setStatus($('save-status'), '', '');
      }
      updateSaveState();
    } catch (err) {
      setStatus($('save-status'), 'Error cargando datos: ' + err.message, 'error');
    }
  }

  function normalizeProjects() {
    const list = store.projects?.data?.projects || [];
    list.forEach(p => {
      if (p.tech && !Array.isArray(p.tech) && typeof p.tech === 'object') {
        p.tech = [
          ...(p.tech.languages || []),
          ...(p.tech.frameworks || []),
          ...(p.tech.tools || [])
        ];
      }
      if (p.team && !Array.isArray(p.team)) p.team = [p.team];
    });
  }

  /* ============================================================
     PESTAÑAS
     Según activeTab, llama al editor correspondiente
     (timeline / skills / projects / code) y limpia la toolbar.
     ============================================================ */
  function renderActive() {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
    const c = $('editor-container');
    const actions = $('toolbar-actions');
    actions.innerHTML = '';
    if (!store[activeTab]) { c.innerHTML = '<p class="admin-empty">Sin datos.</p>'; updateSaveState(); return; }
    if (activeTab === 'timeline') renderTimeline(c, actions);
    else if (activeTab === 'skills') renderSkills(c, actions);
    else if (activeTab === 'projects') renderProjects(c, actions);
    else if (activeTab === 'code') renderCode(c, actions);
    updateSaveState();
  }

  /* ============================================================
     EDITOR DE CRONOLOGÍA (data/timeline.json)
     Sub-pestañas: experiencia / investigación / liderazgo / educación.
     Cada entrada tiene: cargo, org, fechas, viñetas.
     Botones: agregar, subir/bajar, borrar.
     ============================================================ */
  function renderTimeline(c, actions) {
    const data = store.timeline.data;
    TL_SECTIONS.forEach(s => { if (!Array.isArray(data[s.key])) data[s.key] = []; });

    actions.innerHTML = `<button class="admin-btn primary small" id="tl-add"><i class="ri-add-line"></i> Agregar entrada</button>`;
    $('tl-add').onclick = () => {
      data[timelineSection].unshift({ role: '', org: '', start: '', end: '', bullets: [] });
      markDirty(); renderTimeline(c, actions);
    };

    const secTabs = TL_SECTIONS.map(s =>
      `<button class="admin-btn small ${s.key === timelineSection ? 'active' : ''}" data-sec="${s.key}">${s.label} (${data[s.key].length})</button>`
    ).join('');

    const items = data[timelineSection];
    const cards = items.map((it, i) => `
      <div class="admin-card" data-idx="${i}">
        <div class="admin-card-head">
          <span class="admin-card-title">${esc(it.role) || '(sin cargo)'} ${it.org ? '· ' + esc(it.org) : ''}</span>
          <div class="admin-card-actions">
            <button class="admin-btn ghost small" data-act="up" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
            <button class="admin-btn ghost small" data-act="down" ${i === items.length - 1 ? 'disabled' : ''}><i class="ri-arrow-down-line"></i></button>
            <button class="admin-btn danger small" data-act="del"><i class="ri-delete-bin-line"></i></button>
          </div>
        </div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>Cargo / Rol</label><input data-field="role" value="${esc(it.role)}"></div>
          <div class="admin-field"><label>Organización</label><input data-field="org" value="${esc(it.org)}"></div>
          <div class="admin-field"><label>Inicio (AAAA-MM)</label><input data-field="start" value="${esc(it.start)}" placeholder="2023-01"></div>
          <div class="admin-field"><label>Fin (AAAA-MM · vacío = Presente)</label><input data-field="end" value="${esc(it.end)}" placeholder="2024-06"></div>
        </div>
        <div class="admin-field"><label>Viñetas (una por línea)</label><textarea data-field="bullets">${esc(joinLines(it.bullets))}</textarea></div>
      </div>`).join('') || '<p class="admin-empty">No hay entradas en esta sección.</p>';

    c.innerHTML = `<div class="admin-section-tabs">${secTabs}</div>${cards}`;

    c.querySelectorAll('.admin-section-tabs [data-sec]').forEach(b =>
      b.onclick = () => { timelineSection = b.dataset.sec; renderTimeline(c, actions); });

    c.oninput = (e) => {
      const card = e.target.closest('.admin-card'); if (!card) return;
      const it = items[+card.dataset.idx];
      const f = e.target.dataset.field;
      if (f === 'bullets') it.bullets = toLines(e.target.value);
      else it[f] = e.target.value;
      markDirty();
    };
    c.onclick = (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('.admin-card'); const i = +card.dataset.idx;
      if (btn.dataset.act === 'del') { if (confirm('¿Borrar esta entrada?')) { items.splice(i, 1); markDirty(); renderTimeline(c, actions); } }
      else if (btn.dataset.act === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; markDirty(); renderTimeline(c, actions); }
      else if (btn.dataset.act === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; markDirty(); renderTimeline(c, actions); }
    };
  }

  /* ============================================================
     EDITOR DE HABILIDADES (data/skills.json)
     Jerarquía: Grupo → Skills → Docs (enlaces).
     Permite traducir el título del grupo a ES/EN/PT.
     ============================================================ */
  function normalizeSkillItem(item) {
    if (typeof item === 'string') return { name: item, description: '', docs: [] };
    return { name: item.name || '', description: item.description || '', docs: Array.isArray(item.docs) ? item.docs : [] };
  }

  function renderSkills(c, actions) {
    const groups = store.skills.data.groups || (store.skills.data.groups = []);
    // Ensure editable object form in memory
    groups.forEach(g => { g.items = (g.items || []).map(normalizeSkillItem); });

    actions.innerHTML = `<button class="admin-btn primary small" id="sk-add-group"><i class="ri-add-line"></i> Agregar grupo</button>`;
    $('sk-add-group').onclick = () => {
      groups.push({ name: 'grupo-' + (groups.length + 1), emoji: '', label: { es: 'Nuevo grupo', en: 'New group', pt: 'Novo grupo' }, items: [] });
      markDirty(); renderSkills(c, actions);
    };

    c.innerHTML = groups.map((g, gi) => {
      g.label = g.label || {};
      const items = g.items.map((s, si) => `
        <div class="admin-card" style="background:#f8fafc" data-si="${si}">
          <div class="admin-card-head">
            <span class="admin-card-title">${esc(s.name) || '(sin nombre)'}</span>
            <div class="admin-card-actions">
              <button class="admin-btn danger small" data-sact="del-skill"><i class="ri-delete-bin-line"></i></button>
            </div>
          </div>
          <div class="admin-field"><label>Habilidad</label><input data-sfield="name" value="${esc(s.name)}"></div>
          <div class="admin-field"><label>Descripción</label><textarea data-sfield="description">${esc(s.description)}</textarea></div>
          <label class="admin-field" style="margin-bottom:4px"><span style="font-size:13px;font-weight:600;color:#334155">Documentación</span></label>
          <div class="admin-rows">
            ${s.docs.map((d, di) => `
              <div class="admin-row" data-di="${di}">
                <input data-dfield="label" placeholder="Etiqueta" value="${esc(d.label)}">
                <input data-dfield="url" placeholder="https://…" value="${esc(d.url)}">
                <button class="admin-btn danger small" data-sact="del-doc"><i class="ri-close-line"></i></button>
              </div>`).join('')}
          </div>
          <button class="admin-btn ghost small" data-sact="add-doc" style="margin-top:8px"><i class="ri-add-line"></i> Añadir documentación</button>
        </div>`).join('') || '<p class="admin-subtle">Sin habilidades en este grupo.</p>';

      return `
        <div class="admin-card" data-gi="${gi}">
          <div class="admin-card-head">
            <span class="admin-card-title"><i class="ri-folder-line"></i> ${esc(g.label.es || g.name)}</span>
            <div class="admin-card-actions">
              <button class="admin-btn ghost small" data-gact="up" ${gi === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
              <button class="admin-btn ghost small" data-gact="down" ${gi === groups.length - 1 ? 'disabled' : ''}><i class="ri-arrow-down-line"></i></button>
              <button class="admin-btn danger small" data-gact="del-group"><i class="ri-delete-bin-line"></i></button>
            </div>
          </div>
          <div class="admin-grid-2">
            <div class="admin-field"><label>Emoji</label><input data-gfield="emoji" value="${esc(g.emoji)}"></div>
            <div class="admin-field"><label>Clave interna</label><input data-gfield="name" value="${esc(g.name)}"></div>
            <div class="admin-field"><label>Título (ES)</label><input data-gfield="label.es" value="${esc(g.label.es)}"></div>
            <div class="admin-field"><label>Título (EN)</label><input data-gfield="label.en" value="${esc(g.label.en)}"></div>
            <div class="admin-field"><label>Título (PT)</label><input data-gfield="label.pt" value="${esc(g.label.pt)}"></div>
          </div>
          <div style="margin:6px 0 4px;font-size:13px;font-weight:600;color:#334155">Habilidades</div>
          ${items}
          <button class="admin-btn primary small" data-gact="add-skill" style="margin-top:8px"><i class="ri-add-line"></i> Añadir habilidad</button>
        </div>`;
    }).join('') || '<p class="admin-empty">No hay grupos de habilidades.</p>';

    c.oninput = (e) => {
      const gCard = e.target.closest('[data-gi]'); if (!gCard) return;
      const g = groups[+gCard.dataset.gi];
      if (e.target.dataset.gfield) {
        const f = e.target.dataset.gfield;
        if (f.startsWith('label.')) { g.label = g.label || {}; g.label[f.split('.')[1]] = e.target.value; }
        else g[f] = e.target.value;
        markDirty(); return;
      }
      const sCard = e.target.closest('[data-si]'); if (!sCard) return;
      const s = g.items[+sCard.dataset.si];
      if (e.target.dataset.sfield) { s[e.target.dataset.sfield] = e.target.value; markDirty(); return; }
      const row = e.target.closest('[data-di]');
      if (row && e.target.dataset.dfield) { s.docs[+row.dataset.di][e.target.dataset.dfield] = e.target.value; markDirty(); }
    };

    c.onclick = (e) => {
      const btn = e.target.closest('[data-gact],[data-sact]'); if (!btn) return;
      const gCard = btn.closest('[data-gi]'); const gi = +gCard.dataset.gi; const g = groups[gi];
      const gact = btn.dataset.gact, sact = btn.dataset.sact;
      if (gact === 'del-group') { if (confirm('¿Borrar el grupo completo?')) { groups.splice(gi, 1); markDirty(); renderSkills(c, actions); } return; }
      if (gact === 'up' && gi > 0) { [groups[gi - 1], groups[gi]] = [groups[gi], groups[gi - 1]]; markDirty(); return renderSkills(c, actions); }
      if (gact === 'down' && gi < groups.length - 1) { [groups[gi + 1], groups[gi]] = [groups[gi], groups[gi + 1]]; markDirty(); return renderSkills(c, actions); }
      if (gact === 'add-skill') { g.items.push({ name: '', description: '', docs: [] }); markDirty(); return renderSkills(c, actions); }
      const sCard = btn.closest('[data-si]');
      if (sCard) {
        const si = +sCard.dataset.si; const s = g.items[si];
        if (sact === 'del-skill') { g.items.splice(si, 1); markDirty(); return renderSkills(c, actions); }
        if (sact === 'add-doc') { s.docs.push({ label: '', url: '' }); markDirty(); return renderSkills(c, actions); }
        if (sact === 'del-doc') { const row = btn.closest('[data-di]'); s.docs.splice(+row.dataset.di, 1); markDirty(); return renderSkills(c, actions); }
      }
    };
  }

  /* ============================================================
     SUBIDA DE IMÁGENES
     Comprime la imagen a JPEG (máx. 1600px de ancho) para no
     inflar el repo, y la sube a assets/img/projects/ vía putBinary.
     ============================================================ */
  // Resize (keep aspect) and re-encode to JPEG to keep the repo small.
  function resizeToJpegBase64(file, maxW = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }

  async function uploadProjectImage(file, project) {
    if (previewMode) { alert('Inicia sesión con tu token para subir imágenes.'); return null; }
    setStatus($('save-status'), 'Comprimiendo y subiendo imagen…', 'working');
    const base64 = await resizeToJpegBase64(file);
    const safeId = slugify(project.id || 'project');
    const path = `assets/img/projects/${safeId}-${Date.now().toString(36)}.jpg`;
    await G.putBinary(path, base64, `Add image ${path} via admin panel`);
    return path;
  }

  /* ============================================================
     EDITOR DE PROYECTOS (data/projects.json)
     Cada proyecto es un <details> desplegable con todos los campos
     (título, categoría, tech, links, imágenes…).
     ============================================================ */
  function renderProjects(c, actions) {
    const list = store.projects.data.projects || (store.projects.data.projects = []);

    actions.innerHTML = `<button class="admin-btn primary small" id="pj-add"><i class="ri-add-line"></i> Agregar proyecto</button>
      <span class="admin-subtle">${list.length} proyectos</span>`;
    $('pj-add').onclick = () => {
      list.unshift({ id: 'nuevo-' + Date.now().toString(36), title: 'Nuevo proyecto', category: 'software', visible: true });
      markDirty(); renderProjects(c, actions);
    };

    c.innerHTML = list.map((p, i) => {
      p.links = p.links || {};
      return `
      <details class="admin-card" data-idx="${i}">
        <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;list-style:none">
          <span class="admin-card-title">${esc(p.title) || '(sin título)'} <span class="admin-subtle">· ${esc(p.category || '')}${p.visible === false ? ' · oculto' : ''}</span></span>
          <span class="admin-card-actions">
            <button class="admin-btn ghost small" data-act="up" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
            <button class="admin-btn ghost small" data-act="down" ${i === list.length - 1 ? 'disabled' : ''}><i class="ri-arrow-down-line"></i></button>
            <button class="admin-btn danger small" data-act="del"><i class="ri-delete-bin-line"></i></button>
          </span>
        </summary>
        <div class="admin-grid-2" style="margin-top:12px">
          <div class="admin-field"><label>ID (slug)</label><input data-field="id" value="${esc(p.id)}"></div>
          <div class="admin-field"><label>Título</label><input data-field="title" value="${esc(p.title)}"></div>
          <div class="admin-field"><label>Categoría</label><select data-field="category">${CATEGORIES.map(cat => `<option value="${cat}" ${p.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select></div>
          <div class="admin-field"><label>Año</label><input data-field="year" type="number" value="${esc(p.year)}"></div>
          <div class="admin-field"><label>Estado</label><input data-field="status" value="${esc(p.status)}"></div>
          <div class="admin-field"><label>Importancia</label><input data-field="importance" value="${esc(p.importance)}"></div>
          <div class="admin-field"><label>Cliente</label><input data-field="client" value="${esc(p.client)}"></div>
          <div class="admin-field"><label>Contribución</label><input data-field="contribution" value="${esc(p.contribution)}"></div>
          <div class="admin-field"><label>Orden (nº, opcional)</label><input data-field="order" type="number" value="${esc(p.order)}"></div>
          <div class="admin-field"><label>Visible</label><select data-field="visible"><option value="true" ${p.visible !== false ? 'selected' : ''}>Sí</option><option value="false" ${p.visible === false ? 'selected' : ''}>No (oculto)</option></select></div>
        </div>
        <div class="admin-field"><label>Resumen</label><textarea data-field="summary">${esc(p.summary)}</textarea></div>
        <div class="admin-field"><label>Tecnologías (separadas por coma)</label><input data-field="tech" value="${esc(joinCsv(p.tech))}"></div>
        <div class="admin-field"><label>Tags (separados por coma, p.ej. nuevo)</label><input data-field="tags" value="${esc(joinCsv(p.tags))}"></div>
        <div class="admin-field"><label>Equipo (separado por coma)</label><input data-field="team" value="${esc(joinCsv(p.team))}"></div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>Características (una por línea)</label><textarea data-field="features">${esc(joinLines(p.features))}</textarea></div>
          <div class="admin-field"><label>Resultados (uno por línea)</label><textarea data-field="results">${esc(joinLines(p.results))}</textarea></div>
        </div>
        <div class="admin-field"><label>Aprendizajes</label><textarea data-field="learnings">${esc(p.learnings)}</textarea></div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>Thumbnail (ruta)</label><input data-field="thumb" value="${esc(p.thumb)}"></div>
          <div class="admin-field"><label>Imágenes (una ruta por línea)</label><textarea data-field="images">${esc(joinLines(p.images))}</textarea></div>
        </div>
        <div class="admin-field">
          <label>Subir imagen ${previewMode ? '(requiere iniciar sesión)' : ''}</label>
          <input type="file" accept="image/*" data-upload ${previewMode ? 'disabled' : ''}>
          <p class="admin-hint">Se comprime a máx. 1600px (JPEG) y se guarda en <code>assets/img/projects/</code>. La ruta se añade a la lista de imágenes; recuerda Guardar después.</p>
        </div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>Link · Demo</label><input data-field="links.demo" value="${esc(p.links.demo)}"></div>
          <div class="admin-field"><label>Link · Repo</label><input data-field="links.repo" value="${esc(p.links.repo)}"></div>
          <div class="admin-field"><label>Link · Portafolio</label><input data-field="links.portfolio" value="${esc(p.links.portfolio)}"></div>
          <div class="admin-field"><label>Link · Video</label><input data-field="links.video" value="${esc(p.links.video)}"></div>
        </div>
      </details>`;
    }).join('') || '<p class="admin-empty">No hay proyectos.</p>';

    c.oninput = (e) => {
      const card = e.target.closest('[data-idx]'); if (!card) return;
      const p = list[+card.dataset.idx];
      const f = e.target.dataset.field; if (!f) return;
      if (f === 'year' || f === 'order') { const n = e.target.value === '' ? undefined : Number(e.target.value); if (n === undefined) delete p[f]; else p[f] = n; }
      else if (f === 'visible') p.visible = e.target.value === 'true';
      else if (f === 'tech' || f === 'team' || f === 'tags') p[f] = toCsv(e.target.value);
      else if (f === 'features' || f === 'results' || f === 'images') p[f] = toLines(e.target.value);
      else if (f.startsWith('links.')) { p.links = p.links || {}; p.links[f.split('.')[1]] = e.target.value; }
      else p[f] = e.target.value;
      markDirty();
    };
    c.onclick = (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      e.preventDefault();
      const card = btn.closest('[data-idx]'); const i = +card.dataset.idx;
      if (btn.dataset.act === 'del') { if (confirm('¿Borrar este proyecto?')) { list.splice(i, 1); markDirty(); renderProjects(c, actions); } }
      else if (btn.dataset.act === 'up' && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; markDirty(); renderProjects(c, actions); }
      else if (btn.dataset.act === 'down' && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; markDirty(); renderProjects(c, actions); }
    };
    c.onchange = async (e) => {
      const input = e.target.closest('[data-upload]'); if (!input || !input.files || !input.files[0]) return;
      const card = input.closest('[data-idx]'); const p = list[+card.dataset.idx];
      try {
        const path = await uploadProjectImage(input.files[0], p);
        if (path) {
          p.images = Array.isArray(p.images) ? p.images : [];
          p.images.push(path);
          if (!p.thumb) p.thumb = path;
          markDirty();
          renderProjects(c, actions);
          setStatus($('save-status'), `✓ Imagen subida (${path}). Guarda para publicar la referencia.`, 'success');
          const reopened = c.querySelector(`[data-idx="${+card.dataset.idx}"]`); if (reopened) reopened.open = true;
        }
      } catch (err) {
        setStatus($('save-status'), 'Error subiendo imagen: ' + err.message, 'error');
      }
    };
  }

  /* ============================================================
     EDITOR DE PROYECTOS DE CÓDIGO (data/code-projects.json)
     Lista simple: título, descripción, repo, demo y altura del iframe.
     ============================================================ */
  function renderCode(c, actions) {
    const list = store.code.data.projects || (store.code.data.projects = []);
    actions.innerHTML = `<button class="admin-btn primary small" id="cp-add"><i class="ri-add-line"></i> Agregar proyecto</button>`;
    $('cp-add').onclick = () => {
      list.push({ id: 'code-' + Date.now().toString(36), title: 'Nuevo proyecto', description: '', repo: '', demo: '', demoHeight: 400 });
      markDirty(); renderCode(c, actions);
    };

    c.innerHTML = list.map((p, i) => `
      <div class="admin-card" data-idx="${i}">
        <div class="admin-card-head">
          <span class="admin-card-title">${esc(p.title) || '(sin título)'}</span>
          <div class="admin-card-actions">
            <button class="admin-btn ghost small" data-act="up" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
            <button class="admin-btn ghost small" data-act="down" ${i === list.length - 1 ? 'disabled' : ''}><i class="ri-arrow-down-line"></i></button>
            <button class="admin-btn danger small" data-act="del"><i class="ri-delete-bin-line"></i></button>
          </div>
        </div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>ID (slug)</label><input data-field="id" value="${esc(p.id)}"></div>
          <div class="admin-field"><label>Título</label><input data-field="title" value="${esc(p.title)}"></div>
        </div>
        <div class="admin-field"><label>Descripción</label><textarea data-field="description">${esc(p.description)}</textarea></div>
        <div class="admin-grid-2">
          <div class="admin-field"><label>Repositorio (URL)</label><input data-field="repo" value="${esc(p.repo)}"></div>
          <div class="admin-field"><label>Demo (URL, opcional)</label><input data-field="demo" value="${esc(p.demo)}"></div>
          <div class="admin-field"><label>Altura del demo (px)</label><input data-field="demoHeight" type="number" value="${esc(p.demoHeight)}"></div>
        </div>
      </div>`).join('') || '<p class="admin-empty">No hay proyectos de código.</p>';

    c.oninput = (e) => {
      const card = e.target.closest('[data-idx]'); if (!card) return;
      const p = list[+card.dataset.idx]; const f = e.target.dataset.field; if (!f) return;
      if (f === 'demoHeight') p.demoHeight = e.target.value === '' ? undefined : Number(e.target.value);
      else p[f] = e.target.value;
      markDirty();
    };
    c.onclick = (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('[data-idx]'); const i = +card.dataset.idx;
      if (btn.dataset.act === 'del') { if (confirm('¿Borrar este proyecto?')) { list.splice(i, 1); markDirty(); renderCode(c, actions); } }
      else if (btn.dataset.act === 'up' && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; markDirty(); renderCode(c, actions); }
      else if (btn.dataset.act === 'down' && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; markDirty(); renderCode(c, actions); }
    };
  }

  /* ============================================================
     GUARDAR
     getSaveData limpia el JSON (ej. skills sin descripción vuelven
     a ser strings cortos). save() hace PUT a GitHub y actualiza el sha.
     ============================================================ */
  // Copia limpia para guardar en GitHub.
  // En skills: si una skill no tiene descripción ni docs, se guarda solo como string.
  // Se preserva "_documentacion" si existe (comentario de ayuda dentro del JSON).
  function getSaveData(tab) {
    const data = JSON.parse(JSON.stringify(store[tab].data));
    if (tab === 'skills') {
      (data.groups || []).forEach(g => {
        g.items = (g.items || []).map(s => {
          if (typeof s === 'string') return s;
          const docs = (s.docs || []).filter(d => d && (d.label || d.url));
          if (!s.description && docs.length === 0) return s.name;
          const out = { name: s.name };
          if (s.description) out.description = s.description;
          if (docs.length) out.docs = docs;
          return out;
        });
      });
    }
    return data;
  }

  async function save() {
    if (previewMode) {
      setStatus($('save-status'), 'Estás en preview (solo lectura). Entra con tu token para guardar.', 'error');
      return;
    }
    if (!dirty[activeTab]) {
      setStatus($('save-status'), 'No hay cambios pendientes en esta pestaña.', 'working');
      return;
    }
    if (!G.hasToken()) {
      setStatus($('save-status'), 'No hay token. Sal y vuelve a iniciar sesión.', 'error');
      return;
    }

    const btn = $('save-btn'); btn.disabled = true;
    setStatus($('save-status'), 'Guardando en GitHub…', 'working');
    const path = FILES[activeTab];
    const payload = getSaveData(activeTab);

    try {
      // Siempre pedimos el sha fresco justo antes de escribir
      let sha = store[activeTab].sha;
      try {
        const meta = await G.getFileMeta(path);
        sha = meta.sha;
        store[activeTab].sha = sha;
      } catch (metaErr) {
        // Si no podemos leer sha y el archivo existe, el PUT fallará con mensaje claro
        console.warn('No se pudo refrescar sha:', metaErr);
      }

      let res;
      try {
        res = await G.putFile(path, payload, `Update ${path} via admin panel`, sha);
      } catch (putErr) {
        // Conflicto de sha: reintentar una vez con sha nuevo
        if (/409|422|sha/i.test(putErr.message)) {
          const meta = await G.getFileMeta(path);
          store[activeTab].sha = meta.sha;
          res = await G.putFile(path, payload, `Update ${path} via admin panel`, meta.sha);
        } else {
          throw putErr;
        }
      }

      store[activeTab].sha = res.content?.sha || store[activeTab].sha;
      dirty[activeTab] = false;
      const commitUrl = res.commit?.html_url
        || `https://github.com/${G.OWNER}/${G.REPO}/blob/main/${path}`;
      setStatus(
        $('save-status'),
        '✓ Guardado en GitHub. En 1–2 min abre el sitio y recarga fuerte (Cmd+Shift+R).',
        'success'
      );
      // Enlace al commit para que se vea que sí se subió
      const st = $('save-status');
      st.innerHTML = '✓ Guardado. <a href="' + commitUrl + '" target="_blank" rel="noopener">Ver en GitHub</a> · Espera ~1–2 min y recarga el sitio (Cmd+Shift+R).';
      st.className = 'admin-status success';
    } catch (err) {
      setStatus($('save-status'), 'Error al guardar: ' + err.message, 'error');
    } finally {
      updateSaveState();
    }
  }

  /* ============================================================
     INICIO
     Conecta botones (login, preview, logout, save, tabs).
     Si ya hay token guardado, intenta entrar automáticamente.
     beforeunload avisa si hay cambios sin guardar al cerrar la pestaña.
     ============================================================ */
  function init() {
    $('login-btn').onclick = () => {
      const t = $('token-input').value.trim();
      if (!t) { setStatus($('login-status'), 'Pega un token primero.', 'error'); return; }
      setStatus($('login-status'), 'Validando…', 'working');
      tryLogin(t);
    };
    $('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click(); });
    $('preview-btn').onclick = previewLocal;

    $('logout-btn').onclick = () => {
      if (Object.values(dirty).some(Boolean) && !confirm('Hay cambios sin guardar. ¿Salir igualmente?')) return;
      G.clearToken(); location.reload();
    };
    $('save-btn').onclick = save;

    document.querySelectorAll('.admin-tab').forEach(t => t.onclick = () => {
      activeTab = t.dataset.tab; renderActive();
    });

    window.addEventListener('beforeunload', (e) => {
      if (Object.values(dirty).some(Boolean)) { e.preventDefault(); e.returnValue = ''; }
    });

    if (G.hasToken()) tryLogin(G.getToken());
    else showLogin();
  }

  init();
})();

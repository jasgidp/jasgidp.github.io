(async () => {
  const container = document.getElementById('skills-container');
  const chips = document.getElementById('group-chips');
  const search = document.getElementById('skill-search');
  if (!container) return;

  function t(labelObj, fallback) {
    const lang = document.documentElement.lang || 'en';
    return (labelObj && (labelObj[lang] || labelObj['en'])) || fallback || '';
  }

  let groups = [];
  let state = { group: 'all', query: '' };

  function renderChips() {
    const list = [{ key: 'all', label: '✨ All' }, ...groups.map(g => ({ key: g.name, label: `${g.emoji ? g.emoji+ ' ' : ''}${t(g.label, g.name)}` }))];
    chips.innerHTML = list.map(({key,label}) => `<button class="chip${state.group===key?' active':''}" data-group="${key}">${label}</button>`).join('');
  }

  function renderGrid() {
    const filtered = groups
      .filter(g => state.group === 'all' || g.name === state.group)
      .map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(state.query)) }))
      .filter(g => g.items.length > 0);

    container.innerHTML = filtered.map(g => `
      <article class="skill-card">
        <h3>${g.emoji ? g.emoji + ' ' : ''}${t(g.label, g.name)}</h3>
        <ul class="skill-tags">${g.items.map(i => `<li class="tag">${i}</li>`).join('')}</ul>
      </article>
    `).join('') || '<p style="text-align:center;">No skills found.</p>';
  }

  try {
    const res = await fetch('./data/skills.json');
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    groups = data.groups || [];
    renderChips();
    renderGrid();
  } catch (err) {
    console.warn('Failed to load skills.json; ensure the site is served over HTTP(s).', err);
    container.innerHTML = '<p style="text-align:center;">Unable to load skills.</p>';
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.group-chips .chip');
    if (!btn) return;
    state.group = btn.getAttribute('data-group');
    renderChips();
    renderGrid();
  });

  search?.addEventListener('input', (e) => {
    state.query = (e.target.value || '').trim().toLowerCase();
    renderGrid();
  });
})();

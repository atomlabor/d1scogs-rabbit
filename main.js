// Discogs R1 - main.js
// UI fully in English, R1 grid/paging view. Adds full Rabbit R1 scrollwheel support.
(function(){
  const store = {
    get token() { return localStorage.getItem('discogs_token') || ''; },
    set token(v) { localStorage.setItem('discogs_token', v); },
    get user() { return localStorage.getItem('discogs_user') || ''; },
    set user(v) { localStorage.setItem('discogs_user', v); },
    get collection() { try { return JSON.parse(localStorage.getItem('discogs_collection')) || [] } catch { return [] } },
    set collection(v) { localStorage.setItem('discogs_collection', JSON.stringify(v)) }
  };
  function setStatus(text, type = ''){ const el = document.getElementById('status'); if (el) { el.textContent = text; el.className = 'status ' + type; } }
  function showView(viewId){
    const login = document.getElementById('loginView');
    const logged = document.getElementById('loggedInView');
    if (login && logged) { login.style.display = viewId === 'login' ? 'flex' : 'none'; logged.classList.toggle('active', viewId === 'loggedIn'); }
    const cv = document.getElementById('collectionView'); if (cv) cv.classList.remove('active');
  }
  const UA = 'DiscogsR1/1.0 +https://github.com/atomlabor/d1scogs-rabbit';
  const corsProxies = ['', 'https://cors.isomorphic-git.org/', 'https://api.allorigins.win/raw?url=', 'https://r.jina.ai/http://'];
  async function discogsFetch(url, opts={}){
    const headers = Object.assign({ 'User-Agent': UA }, opts.headers||{});
    const attempt = async (prefix) => {
      const finalUrl = prefix === 'https://r.jina.ai/http://' ? (prefix + url.replace(/^https?:\/\//,'').replace(/^https:\/\//,'http://')) : (prefix + url);
      const res = await fetch(finalUrl, Object.assign({}, opts, { headers }));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    };
    let lastErr; for (const p of corsProxies) { try { return await attempt(p); } catch(e){ lastErr = e; } }
    throw lastErr || new Error('Fetch failed');
  }
  async function login(){
    const tokenEl = document.getElementById('token'); const userEl = document.getElementById('username');
    const token = tokenEl ? tokenEl.value.trim() : ''; const username = userEl ? userEl.value.trim() : '';
    if (!token || !username) { setStatus('Please enter token and username', 'error'); return; }
    setStatus('Signing in...');
    try {
      const profileRes = await discogsFetch(`https://api.discogs.com/users/${encodeURIComponent(username)}`, { headers: { 'Authorization': `Discogs token=${token}` }});
      const data = await profileRes.json(); if (!data || !data.username) throw new Error('Invalid API response');
      store.token = token; store.user = username;
      const w = document.getElementById('welcome'); if (w) w.textContent = `Signed in: ${data.username}`;
      showView('loggedIn'); setStatus(''); await loadCollection(); toggleCollection(true);
    } catch (error){ setStatus(`Error: ${error.message}`, 'error'); }
  }
  async function loadCollection(){
    if (!store.user || !store.token) return; setStatus('Loading collection...');
    try {
      let page = 1; const perPage = 100; let all = [];
      while (true){
        const url = `https://api.discogs.com/users/${encodeURIComponent(store.user)}/collection/folders/0/releases?token=${encodeURIComponent(store.token)}&page=${page}&per_page=${perPage}`;
        const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
        const json = await res.json(); const items = (json && json.releases) ? json.releases : [];
        all = all.concat(items.map(r => ({
          id: r.id || (r.instance_id ? `inst-${r.instance_id}` : (r.basic_information?.id || '')),
          title: r.basic_information?.title || 'Unknown',
          artist: (r.basic_information?.artists?.[0]?.name) || 'Unknown',
          year: r.basic_information?.year || '',
          thumb: r.basic_information?.thumb || '',
          label: (r.basic_information?.labels?.[0]?.name) || '',
          genres: (r.basic_information?.genres || []).join(', ')
        })));
        if (!json.pagination || page >= json.pagination.pages) break; page++;
      }
      store.collection = all; currentPage = 1; renderCollection(); setStatus(`Collection loaded: ${all.length} items`, 'success');
    } catch(e){ setStatus('Could not load collection: ' + e.message, 'error'); }
  }
  const PAGE_SIZE = 5; let currentPage = 1;
  function setPage(n){ const total = Math.max(1, Math.ceil(getFiltered().length / PAGE_SIZE)); currentPage = Math.min(Math.max(1, n), total); renderCollection(); }
  function getFiltered(){ const term = (document.getElementById('searchInput')?.value || '').toLowerCase(); return store.collection.filter(x => !term || (x.title||'').toLowerCase().includes(term) || (x.artist||'').toLowerCase().includes(term) || (String(x.year||'')).includes(term)); }
  function renderCollection(){
    const list = document.getElementById('collectionList'); if (!list) return;
    const data = getFiltered(); const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE)); const start = (currentPage - 1) * PAGE_SIZE; const pageItems = data.slice(start, start + PAGE_SIZE);
    list.innerHTML = `
      <div class="grid">
        ${pageItems.map(x => `
          <div class="card-item">
            <div class="thumb" style="background-image:url('${escapeHtml(x.thumb||'')}')"></div>
            <div class="title">${escapeHtml(x.title)}</div>
            <div class="meta">${escapeHtml(x.artist)} • ${escapeHtml(String(x.year||''))}</div>
            <div class="actions-row">
              <button class="btn-mini" onclick="window.showDetail('${encodeURIComponent(String(x.id))}')">Info</button>
              <button class="btn-mini" onclick="window.openRelease('${encodeURIComponent(String(x.id))}')">Open</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="pager">
        <button class="btn-secondary" onclick="window.setPage(${currentPage-1})">Prev</button>
        <div class="page-indicator">${currentPage}/${totalPages}</div>
        <button class="btn-secondary" onclick="window.setPage(${currentPage+1})">Next</button>
      </div>
    `;
  }
  function clearSearch(){ const s = document.getElementById('searchInput'); if(s){ s.value=''; currentPage=1; renderCollection(); } }
  function toggleCollection(show){ if (!store.token) { setStatus('Please sign in first', 'error'); return; } const v = document.getElementById('collectionView'); if (v) v.classList.toggle('active', !!show); renderCollection(); }
  async function showDetail(id){
    try{
      const numericId = decodeURIComponent(String(id)).replace(/^inst-/, '');
      const res = await discogsFetch(`https://api.discogs.com/releases/${numericId}`); const r = await res.json();
      const cover = r.thumb || (r.images && r.images[0]?.uri) || ''; const artist = (r.artists && r.artists[0]?.name) || 'Unknown';
      const genres = (r.genres||[]).join(', '); const styles = (r.styles||[]).join(', '); const label = (r.labels && r.labels[0]?.name) || ''; const year = r.year || '';
      const tracks = (r.tracklist||[]).slice(0,10).map(t => `${t.position||''} ${t.title||''}`).join(' | ');
      openModal({ title: r.title || 'Unknown', content: `
          <div class="detail">
            <div class="detail-cover" style="background-image:url('${escapeHtml(cover)}')"></div>
            <div class="detail-lines">
              Artist: ${escapeHtml(artist)}
              Year: ${escapeHtml(String(year))}
              Label: ${escapeHtml(label)}
              Genre/Style: ${escapeHtml([genres, styles].filter(Boolean).join(' / '))}
              <div class="tracks">Tracklist: ${escapeHtml(tracks)}</div>
            </div>
          </div>
        `});
    }catch(e){ setStatus('Failed to load detail: ' + e.message, 'error'); }
  }
  function openRelease(id){ const numericId = decodeURIComponent(String(id)).replace(/^inst-/, ''); window.open(`https://www.discogs.com/release/${numericId}`, '_blank'); }
  function openModal({title, content}){ const overlay = document.getElementById('detailOverlay'); const titleEl = document.getElementById('detailTitle'); const bodyEl = document.getElementById('detailBody'); if (!overlay || !titleEl || !bodyEl) return; titleEl.textContent = title; bodyEl.innerHTML = content; overlay.classList.add('active'); }
  function closeModal(){ document.getElementById('detailOverlay')?.classList.remove('active'); }
  function openScan(){ if(!store.token){ setStatus('Please sign in first', 'error'); return; } document.getElementById('scanOverlay').classList.add('active'); document.getElementById('codeInput').focus(); }
  function closeScan(){ document.getElementById('scanOverlay').classList.remove('active'); const hits = document.getElementById('scanHits'); if(hits){ hits.hidden = true; hits.innerHTML = ''; } }
  async function searchBarcode(){
    const code = document.getElementById('codeInput').value.trim(); if (!code){ setStatus('Please enter a barcode', 'error'); return; }
    setStatus('Searching barcode...');
    try{
      const url = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(code)}&token=${encodeURIComponent(store.token)}`;
      const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
      const json = await res.json(); const results = json && json.results ? json.results : [];
      renderScanHits(results); setStatus(results.length ? `${results.length} hits` : 'No hits');
    } catch(e){ setStatus('Barcode search failed: ' + e.message, 'error'); }
  }
  function renderScanHits(results){
    const wrap = document.getElementById('scanHits'); if (!wrap) return; if (!results.length){ wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false; wrap.innerHTML = results.slice(0,10).map(r => {
      const title = r.title || 'Unknown'; const year = r.year || ''; const format = (r.format && r.format.join(', ')) || ''; const id = r.id; const thumb = r.thumb || '';
      return `
        <div class="hit">
          <div class="hit-row">
            <div class="hit-thumb" style="background-image:url('${escapeHtml(thumb)}')"></div>
            <div class="hit-text">
              <div class="title">${escapeHtml(title)}</div>
              <div class="meta">${escapeHtml([year, format].filter(Boolean).join(' • '))}</div>
            </div>
          </div>
          <div class="hit-actions">
            <button class="btn-secondary" onclick="window.addRelease(${JSON.stringify(id)})">Add</button>
            <button class="btn" onclick="window.open('https://www.discogs.com/release/${id}','_blank')">Open</button>
          </div>
        </div>
      `;
    }).join('');
  }
  async function addRelease(releaseId){
    try { const res = await discogsFetch(`https://api.discogs.com/releases/${releaseId}`); const r = await res.json();
      const entry = { id: r.id, title: r.title || 'Unknown', artist: (r.artists && r.artists[0]?.name) || 'Unknown', year: r.year || '', thumb: (r.thumb || (r.images && r.images[0]?.uri) || ''), label: (r.labels && r.labels[0]?.name) || '', genres: (r.genres||[]).join(', ') };
      const col = store.collection; col.unshift(entry); store.collection = col; setStatus('Item added', 'success'); currentPage = 1; renderCollection();
    } catch(e){ setStatus('Add failed: ' + e.message, 'error'); }
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"','\'':''}[c])); }

  // Rabbit R1 scrollwheel support
  function onWheel(ev){
    try{
      if (!ev) return; ev.preventDefault(); const delta = ev.deltaY || ev.wheelDelta || 0; if (typeof delta !== 'number' || delta === 0) return;
      if (delta > 0) setPage(currentPage + 1); else setPage(currentPage - 1);
      if (window.rabbit && typeof window.rabbit.onScroll === 'function') { window.rabbit.onScroll({ deltaY: delta, direction: delta > 0 ? 'down' : 'up' }); }
    }catch(e){ /* no-op */ }
  }

  // Expose API
  window.login = login;
  window.logout = function(){ store.token = ''; store.user = ''; const t = document.getElementById('token'); if (t) t.value = ''; const u = document.getElementById('username'); if (u) u.value = ''; showView('login'); setStatus('Signed out'); };
  window.toggleCollection = toggleCollection; window.clearSearch = clearSearch; window.renderCollection = renderCollection; window.openScan = openScan; window.closeScan = closeScan; window.searchBarcode = searchBarcode; window.addRelease = addRelease; window.showDetail = showDetail; window.openRelease = openRelease; window.setPage = setPage; window.closeModal = closeModal;

  // Init and attach scroll listeners
  window.addEventListener('DOMContentLoaded', async () => {
    if (store.token && store.user) {
      const t = document.getElementById('token'); if (t) t.value = store.token;
      const u = document.getElementById('username'); if (u) u.value = store.user;
      const w = document.getElementById('welcome'); if (w) w.textContent = `Welcome back: ${store.user}`;
      showView('loggedIn'); await loadCollection(); toggleCollection(true);
    }
    // Attach wheel listener non-passive to intercept R1 wheel
    window.addEventListener('wheel', onWheel, { passive: false });
    // If Rabbit SDK offers a subscribe mechanism, wire it as well (defensive)
    if (window.rabbit && typeof window.rabbit.onScroll === 'function') {
      // no extra subscription API documented; onWheel will call onScroll proactively
      // This ensures both browser wheel and Rabbit SDK consumers stay in sync
    }
  });
})();

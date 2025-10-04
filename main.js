// Discogs R1 - main.js
// Connect Collection and Scan to Discogs API. Live fetch. Login bleibt. R1 optimiert.

(function(){
  // Simple store using localStorage
  const store = {
    get token() { return localStorage.getItem('discogs_token') || ''; },
    set token(v) { localStorage.setItem('discogs_token', v); },
    get user() { return localStorage.getItem('discogs_user') || ''; },
    set user(v) { localStorage.setItem('discogs_user', v); },
    get collection() {
      try { return JSON.parse(localStorage.getItem('discogs_collection')) || [] } catch { return [] }
    },
    set collection(v) { localStorage.setItem('discogs_collection', JSON.stringify(v)) }
  };

  // Helpers
  function setStatus(text, type = ''){
    const el = document.getElementById('status');
    if (el) { el.textContent = text; el.className = 'status ' + type; }
  }
  function showView(viewId){
    const login = document.getElementById('loginView');
    const logged = document.getElementById('loggedInView');
    if (login && logged) {
      login.style.display = viewId === 'login' ? 'flex' : 'none';
      logged.classList.toggle('active', viewId === 'loggedIn');
    }
    document.getElementById('collectionView')?.classList.remove('active');
  }

  // Build Discogs API URL with CORS fallback
  const UA = 'DiscogsR1/1.0 +https://github.com/atomlabor/d1scogs-rabbit';
  const corsProxies = [
    '', // direct first
    'https://cors.isomorphic-git.org/',
    'https://api.allorigins.win/raw?url=',
    'https://r.jina.ai/http://', // last resort (GET-only)
  ];
  async function discogsFetch(url, opts={}){
    const headers = Object.assign({ 'User-Agent': UA }, opts.headers||{});
    const attempt = async (prefix) => {
      const finalUrl = prefix === 'https://r.jina.ai/http://' ? (prefix + url.replace(/^https?:\/\//,'').replace(/^https:\/\//,'http://')) : (prefix + url);
      const res = await fetch(finalUrl, Object.assign({}, opts, { headers }));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    };
    let lastErr;
    for (const p of corsProxies) {
      try { return await attempt(p); } catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('Fetch failed');
  }

  // Login and load profile
  async function login(){
    const token = document.getElementById('token').value.trim();
    const username = document.getElementById('username').value.trim();
    if (!token || !username) { setStatus('Bitte Token und Username eingeben', 'error'); return; }
    setStatus('Anmeldung läuft...');
    try {
      const profileRes = await discogsFetch(`https://api.discogs.com/users/${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Discogs token=${token}` }
      });
      const data = await profileRes.json();
      if (!data || !data.username) throw new Error('Ungültige API-Antwort');
      store.token = token; store.user = username;
      document.getElementById('welcome').textContent = `Login erfolgreich: ${data.username}`;
      showView('loggedIn');
      setStatus('');
      // Load real collection after login
      await loadCollection();
      toggleCollection(true);
    } catch (error){
      setStatus(`Fehler: ${error.message}`, 'error');
    }
  }

  // Load real collection from Discogs (folder 0 = All)
  async function loadCollection(){
    if (!store.user || !store.token) return;
    setStatus('Lade Collection...');
    try {
      let page = 1; const perPage = 100; let all = [];
      while (true){
        const url = `https://api.discogs.com/users/${encodeURIComponent(store.user)}/collection/folders/0/releases?token=${encodeURIComponent(store.token)}&page=${page}&per_page=${perPage}`;
        const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
        const json = await res.json();
        const items = (json && json.releases) ? json.releases : [];
        all = all.concat(items.map(r => ({
          id: r.id || (r.instance_id ? `inst-${r.instance_id}` : (r.basic_information?.id || '')),
          title: r.basic_information?.title || 'Unbekannt',
          artist: (r.basic_information?.artists?.[0]?.name) || 'Unbekannt',
          year: r.basic_information?.year || ''
        })));
        if (!json.pagination || page >= json.pagination.pages) break;
        page++;
      }
      store.collection = all;
      renderCollection();
      setStatus(`Collection geladen: ${all.length} Einträge`, 'success');
    } catch(e){
      setStatus('Konnte Collection nicht laden: ' + e.message, 'error');
    }
  }

  // Render / search
  function renderCollection(){
    const list = document.getElementById('collectionList');
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const data = store.collection.filter(x =>
      !term || (x.title||'').toLowerCase().includes(term) || (x.artist||'').toLowerCase().includes(term) || (x.year+'' ).includes(term)
    );
    if (!list) return;
    list.innerHTML = data.map(x => `
      <div class="row">
        <div>
          <div class="title">${escapeHtml(x.title)}</div>
          <div class="meta">${escapeHtml(x.artist)} • ${escapeHtml(String(x.year||''))}</div>
        </div>
        <div class="meta">${escapeHtml(String(x.id||''))}</div>
      </div>`).join('');
  }
  function clearSearch(){ const s = document.getElementById('searchInput'); if(s){ s.value=''; renderCollection(); } }
  function toggleCollection(show){
    if (!store.token) { setStatus('Bitte zuerst einloggen', 'error'); return; }
    const v = document.getElementById('collectionView');
    if (v) v.classList.toggle('active', !!show);
    renderCollection();
  }

  // Scan overlay and barcode search
  function openScan(){
    if(!store.token){ setStatus('Bitte zuerst einloggen', 'error'); return; }
    document.getElementById('scanOverlay').classList.add('active');
    document.getElementById('codeInput').focus();
  }
  function closeScan(){ document.getElementById('scanOverlay').classList.remove('active'); const hits = document.getElementById('scanHits'); if(hits){ hits.hidden = true; hits.innerHTML = ''; } }

  async function searchBarcode(){
    const code = document.getElementById('codeInput').value.trim();
    if (!code){ setStatus('Bitte Barcode eingeben', 'error'); return; }
    setStatus('Suche nach Barcode...');
    try{
      const url = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(code)}&token=${encodeURIComponent(store.token)}`;
      const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
      const json = await res.json();
      const results = json && json.results ? json.results : [];
      renderScanHits(results);
      setStatus(results.length ? `${results.length} Treffer` : 'Keine Treffer');
    } catch(e){
      setStatus('Scan-Suche fehlgeschlagen: ' + e.message, 'error');
    }
  }

  function renderScanHits(results){
    const wrap = document.getElementById('scanHits');
    if (!wrap) return;
    if (!results.length){ wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = results.slice(0,20).map(r => {
      const title = r.title || 'Unbekannt';
      const year = r.year || '';
      const format = (r.format && r.format.join(', ')) || '';
      const id = r.id;
      return `
        <div class="hit">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${escapeHtml([year, format].filter(Boolean).join(' • '))}</div>
          <button class="btn" style="padding:8px;margin-top:4px;" onclick="window.addRelease(${JSON.stringify(id)})">Zur Collection</button>
        </div>
      `;
    }).join('');
  }

  async function addRelease(releaseId){
    try {
      // Fetch release detail to display meaningful info locally
      const res = await discogsFetch(`https://api.discogs.com/releases/${releaseId}`);
      const r = await res.json();
      const entry = {
        id: r.id,
        title: r.title || 'Unbekannt',
        artist: (r.artists && r.artists[0]?.name) || 'Unbekannt',
        year: r.year || ''
      };
      const col = store.collection; col.unshift(entry); store.collection = col;
      renderCollection();
      setStatus('Eintrag hinzugefügt', 'success');
    } catch(e){
      setStatus('Hinzufügen fehlgeschlagen: ' + e.message, 'error');
    }
  }

  // Escaper
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  // Expose API
  window.login = login;
  window.logout = function(){
    store.token = ''; store.user = '';
    const t = document.getElementById('token'); if (t) t.value = '';
    const u = document.getElementById('username'); if (u) u.value = '';
    showView('login'); setStatus('Abgemeldet');
  };
  window.toggleCollection = toggleCollection;
  window.clearSearch = clearSearch;
  window.renderCollection = renderCollection;
  window.openScan = openScan;
  window.closeScan = closeScan;
  window.searchBarcode = searchBarcode;
  window.addRelease = addRelease;

  // Auto-login if credentials exist
  window.addEventListener('DOMContentLoaded', async () => {
    if (store.token && store.user) {
      const t = document.getElementById('token'); if (t) t.value = store.token;
      const u = document.getElementById('username'); if (u) u.value = store.user;
      const w = document.getElementById('welcome'); if (w) w.textContent = `Willkommen zurück: ${store.user}`;
      showView('loggedIn');
      await loadCollection();
      toggleCollection(true);
    }
  });
})();

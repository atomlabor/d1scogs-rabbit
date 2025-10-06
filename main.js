// D1scogs r1 - main.js
// UI fully in English, r1 grid/paging view. Adds full Rabbit r1 scrollwheel support.
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
  const cv = document.getElementById('collectionView');
  if (cv) cv.classList.remove('active');
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
  const tokenEl = document.getElementById('token');
  const userEl = document.getElementById('username');
  const token = tokenEl ? tokenEl.value.trim() : '';
  const username = userEl ? userEl.value.trim() : '';
  if (!token || !username) { setStatus('Please enter token and username', 'error'); return; }
  setStatus('Signing in...');
  try {
    const profileRes = await discogsFetch(`https://api.discogs.com/users/${encodeURIComponent(username)}`, {
      headers: { 'Authorization': `Discogs token=${token}` }
    });
    const data = await profileRes.json();
    if (!data || !data.username) throw new Error('Invalid API response');
    store.token = token; store.user = username;
    const w = document.getElementById('welcome'); if (w) w.textContent = `Signed in: ${data.username}`;
    showView('loggedIn');
    setStatus('');
    // Load real collection after login
    await loadCollection();
    toggleCollection(true);
  } catch (error){
    setStatus(`Error: ${error.message}`, 'error');
  }
 }
 // Load collection from Discogs (folder 0 = All)
 async function loadCollection(){
  if (!store.user || !store.token) return;
  setStatus('Loading collection...');
  try {
    let page = 1; const perPage = 100; let all = [];
    while (true){
      const url = `https://api.discogs.com/users/${encodeURIComponent(store.user)}/collection/folders/0/releases?token=${encodeURIComponent(store.token)}&page=${page}&per_page=${perPage}`;
      const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
      const json = await res.json();
      const items = (json && json.releases) ? json.releases : [];
      all = all.concat(items.map(r => ({
        id: r.id || (r.instance_id ? `inst-${r.instance_id}` : (r.basic_information?.id || '')),
        title: r.basic_information?.title || 'Unknown',
        artist: (r.basic_information?.artists?.[0]?.name) || 'Unknown',
        year: r.basic_information?.year || '',
        thumb: r.basic_information?.thumb || '',
        label: (r.basic_information?.labels?.[0]?.name) || '',
        genres: (r.basic_information?.genres || []).join(', ')
      })));
      if (!json.pagination || page >= json.pagination.pages) break;
      page++;
    }
    store.collection = all;
    currentPage = 1; // reset paging on load
    renderCollection();
    setStatus(`Collection loaded: ${all.length} items`, 'success');
  } catch(e){
    setStatus('Could not load collection: ' + e.message, 'error');
  }
 }
 // Paging state for no-scroll R1 grid
 const PAGE_SIZE = 5; // at most five cards, never scroll body
 let currentPage = 1;
 function setPage(n){
  const total = Math.max(1, Math.ceil(getFiltered().length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, n), total);
  renderCollection();
 }
 function getFiltered(){
  const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
  return store.collection.filter(x =>
    !term || (x.title||'').toLowerCase().includes(term) || (x.artist||'').toLowerCase().includes(term) || (String(x.year||'')).includes(term)
  );
 }
 // Escape
 function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 }
 // Render compact list with info button, no external link
 function renderCollection(){
  const list = document.getElementById('collectionList');
  if (!list) return;
  const data = getFiltered();
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = data.slice(start, start + PAGE_SIZE);
  list.innerHTML = `
    <div class="grid" id="collectionGrid">
      ${pageItems.map(x => `
        <div class="item">
          <img alt="${escapeHtml(x.title)}" class="thumb" loading="lazy"/>
          <div class="info">
            <div class="title">${escapeHtml(x.title)}</div>
            <div class="meta">${escapeHtml(x.artist)} • ${escapeHtml(String(x.year||''))}</div>
          </div>
          <button aria-label="Info" class="btn-info" data-id="${escapeHtml(x.id)}" title="Info">
            <svg fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" x2="12" y1="16" y2="12"></line>
              <line x1="12" x2="12" y1="8" y2="8"></line>
            </svg>
          </button>
        </div>
      `).join('')}
      <div class="paging"><span class="page-info">${currentPage}/${totalPages}</span></div>
    </div>
  `;
  // attach info handlers
  list.querySelectorAll('.btn-info').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      showDetail(id);
    });
  });
 }
 function clearSearch(){ const s = document.getElementById('searchInput'); if(s){ s.value=''; currentPage=1; renderCollection(); } }
 function toggleCollection(show){
  if (!store.token) { setStatus('please sign in first', 'error'); return; }
  const v = document.getElementById('collectionView');
  if (v) v.classList.toggle('active', !!show);
  renderCollection();
 }
 // Detail overlay with Back button (no external link)
 async function showDetail(id){
  try{
    const numericId = decodeURIComponent(String(id)).replace(/^inst-/, '');
    const res = await discogsFetch(`https://api.discogs.com/releases/${numericId}`);
    const r = await res.json();
    const cover = r.thumb || (r.images && r.images[0]?.uri) || '';
    const artist = (r.artists && r.artists[0]?.name) || 'Unknown';
    const genres = (r.genres||[]).join(', ');
    const styles = (r.styles||[]).join(', ');
    const label = (r.labels && r.labels[0]?.name) || '';
    const year = r.year || '';
    const tracks = (r.tracklist||[]).slice(0,10).map(t => `${t.position||''} ${t.title||''}`).join(' | ');
    openModal({
      title: r.title || 'unknown',
      content: `
        <div class="detail-content">
          <img alt="${escapeHtml(r.title || 'unknown')}" class="detail-cover"/>
          <div class="detail-info">
            <div>Artist: ${escapeHtml(artist)}</div>
            <div>Year: ${escapeHtml(String(year))}</div>
            <div>Label: ${escapeHtml(label)}</div>
            <div>Genre/Style: ${escapeHtml([genres, styles].filter(Boolean).join(' / '))}</div>
            <div>Tracklist: ${escapeHtml(tracks)}</div>
          </div>
        </div>
      `
    });
  }catch(e){ setStatus('Failed to load detail: ' + e.message, 'error'); }
 }
 // Modal overlay helpers
 function openModal({title, content}){
  const overlay = document.getElementById('detailOverlay');
  const titleEl = document.getElementById('detailTitle');
  const bodyEl = document.getElementById('detailBody');
  if (!overlay || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = content;
  overlay.classList.add('active');
 }
 function closeModal(){ document.getElementById('detailOverlay')?.classList.remove('active'); }
 // Scan overlay
 function openScan(){ if(!store.token){ setStatus('please sign in first', 'error'); return; } document.getElementById('scanOverlay').classList.add('active'); document.getElementById('codeInput').focus(); }
 function closeScan(){ document.getElementById('scanOverlay').classList.remove('active'); const hits = document.getElementById('scanHits'); if(hits){ hits.hidden = true; hits.innerHTML = ''; } }
 async function searchBarcode(){
  const code = document.getElementById('codeInput').value.trim();
  if (!code){ setStatus('please enter a barcode number', 'error'); return; }
  setStatus('searching barcode...');
  try{
    const url = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(code)}&token=${encodeURIComponent(store.token)}`;
    const res = await discogsFetch(url, { headers: { 'Authorization': `Discogs token=${store.token}` }});
    const json = await res.json();
    const results = json && json.results ? json.results : [];
    renderScanHits(results);
    setStatus(results.length ? `${results.length} hits` : 'No hits');
  } catch(e){ setStatus('barcode search failed: ' + e.message, 'error'); }
 }
 function renderScanHits(results){
  const hits = document.getElementById('scanHits');
  if (!hits) return;
  if (!results || results.length === 0){
    hits.hidden = false;
    hits.innerHTML = '<div class="hit-item">No results for this barcode.</div>';
    return;
  }
  hits.hidden = false;
  hits.innerHTML = results.slice(0,20).map(r => {
    const title = `${r.title || ''}`;
    const year = r.year || '';
    const country = r.country || '';
    const format = (r.format || []).join(', ');
    const thumb = r.thumb || '';
    const id = r.id || r.master_id || '';
    return `
      <div class="hit-item">
        <img class="hit-thumb" alt="${escapeHtml(title)}" src="${escapeHtml(thumb)}"/>
        <div class="hit-info">
          <div class="hit-title">${escapeHtml(title)}</div>
          <div class="hit-meta">${escapeHtml([year, country, format].filter(Boolean).join(' • '))}</div>
        </div>
        <div class="hit-actions">
          <button class="btn-info" data-id="${escapeHtml(String(id))}" title="Info">i</button>
        </div>
      </div>
    `;
  }).join('');
  // attach info open on each result
  hits.querySelectorAll('.btn-info').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) { closeScan(); showDetail(id); }
    });
  });
 }
 // Expose API
 window.login = login;
 window.logout = function(){ store.token = ''; store.user = ''; const t = document.getElementById('token'); if (t) t.value = ''; const u = document.getElementById('username'); if (u) u.value = ''; showView('login'); setStatus('Signed out'); };
 window.toggleCollection = toggleCollection;
 window.clearSearch = clearSearch;
 window.renderCollection = renderCollection;
 window.openScan = openScan;
 window.closeScan = closeScan;
 window.searchBarcode = searchBarcode;
 window.showDetail = showDetail;
 window.closeModal = closeModal;
 // INIT
 window.addEventListener('DOMContentLoaded', async () => {
  if (store.token && store.user) {
    const t = document.getElementById('token'); if (t) t.value = store.token;
    const u = document.getElementById('username'); if (u) u.value = store.user;
    const w = document.getElementById('welcome'); if (w) w.textContent = `welcome back: ${store.user}`;
    showView('loggedIn');
    await loadCollection();
    toggleCollection(true);
  }
  if (document && document.body) { document.body.style.background = '#000000'; }
  // R1 scrollwheel and key support -> vertical paging of collection only
  (function(){
    document.addEventListener('wheel', (e) => {
      const cv = document.getElementById('collectionView');
      if (!cv || !cv.classList.contains('active')) return;
      e.preventDefault();
      if (e.deltaY < 0) window.dispatchEvent(new CustomEvent('scrollUp'));
      if (e.deltaY > 0) window.dispatchEvent(new CustomEvent('scrollDown'));
    }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp') { e.preventDefault(); window.dispatchEvent(new CustomEvent('scrollUp')); }
      if (e.code === 'ArrowDown') { e.preventDefault(); window.dispatchEvent

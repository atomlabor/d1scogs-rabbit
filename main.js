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
 const PAGE_SIZE = 5; // at most five cards, never scroll
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

 // Render compact grid with paging and info button
 function renderCollection(){
 const list = document.getElementById('collectionList');
 if (!list) return;
 const data = getFiltered();
 const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
 const start = (currentPage - 1) * PAGE_SIZE;
 const pageItems = data.slice(start, start + PAGE_SIZE);
 list.innerHTML = `

 ${pageItems.map(x => `

<img src="${x.thumb}" alt="${escapeHtml(x.title)}" class="thumb" loading="lazy"/>

${escapeHtml(x.title)}
${escapeHtml(x.artist)} • ${escapeHtml(String(x.year||''))}


 <svg fill="none" height="20" style="display:inline-block;vertical-align:middle" viewbox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
 <rect fill="none" height="8" rx="2" stroke="currentColor" stroke-width="2" width="8" x="4" y="8"></rect>
 <path d="M10 10 L16 4" stroke="currentColor" stroke-width="2"></path>
 <polyline fill="none" points="13 4, 16 4, 16 7" stroke="currentColor" stroke-width="2"></polyline>
 </svg>

 `).join('')}


<div class="page-counter">
${currentPage}/${totalPages}
</div>

 `;
 }

 function clearSearch(){ const s = document.getElementById('searchInput'); if(s){ s.value=''; currentPage=1; renderCollection(); } }

 function toggleCollection(show){
 if (!store.token) { setStatus('please sign in first', 'error'); return; }
 const v = document.getElementById('collectionView');
 if (v) v.classList.toggle('active', !!show);
 renderCollection();
 }

 // Detail overlay with Back button (no scroll)
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
 <img src="${cover}" alt="${escapeHtml(r.title || 'unknown')}" class="detail-cover"/>

 Artist: ${escapeHtml(artist)}
 Year: ${escapeHtml(String(year))}
 Label: ${escapeHtml(label)}
 Genre/Style: ${escapeHtml([genres, styles].filter(Boolean).join(' / '))}
 Tracklist: ${escapeHtml(tracks)}


 `
 });
 }catch(e){ setStatus('Failed to load detail: ' + e.message, 'error'); }
 }

 function openRelease(id){
 const numericId = decodeURIComponent(String(id)).replace(/^inst-/, '');
 window.open(`https://www.discogs.com/release/${numericId}`, '_blank');
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

 function closeModal(){
 document.getElementById('detailOverlay')?.classList.remove('active');
 }

 // Scan overlay and barcode search
 function openScan(){
 if(!store.token){ setStatus('please sign in first', 'error'); return; }
 document.getElementById('scanOverlay').classList.add('active');
 document.getElementById('codeInput').focus();
 }

 function closeScan(){ 
 document.getElementById('scanOverlay').classList.remove('active'); 
 const hits = document.getElementById('scanHits'); 
 if(hits){ hits.hidden = true; hits.innerHTML = ''; } 
 }

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
 } catch(e){
 setStatus('barcode search failed: ' + e.message, 'error');
 }
 }

 function renderScanHits(results){
 const wrap = document.getElementById('scanHits');
 if (!wrap) return;
 if (!results.length){ wrap.hidden = true; wrap.innerHTML = ''; return; }
 wrap.hidden = false;
 wrap.innerHTML = results.slice(0,10).map(r => {
 const title = r.title || 'Unknown';
 const year = r.year || '';
 const format = (r.format && r.format.join(', ')) || '';
 const id = r.id;
 const thumb = r.thumb || '';
 return `
 <div class="hit-card" onclick="addRelease(${id})">
<img src="${thumb}" alt="${escapeHtml(title)}" class="hit-thumb" loading="lazy"/>

${escapeHtml(title)}
${escapeHtml([year, format].filter(Boolean).join(' • '))}

 <svg fill="none" height="20" style="display:inline-block;vertical-align:middle" viewbox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
 <rect fill="none" height="8" rx="2" stroke="currentColor" stroke-width="2" width="8" x="4" y="8"></rect>
 <path d="M10 10 L16 4" stroke="currentColor" stroke-width="2"></path>
 <polyline fill="none" points="13 4, 16 4, 16 7"
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
 title: r.title || 'unknown',
 artist: (r.artists && r.artists[0]?.name) || 'unknown',
 year: r.year || '',
 thumb: (r.thumb || (r.images && r.images[0]?.uri) || ''),
 label: (r.labels && r.labels[0]?.name) || '',
 genres: (r.genres||[]).join(', ')
 };
 const col = store.collection; col.unshift(entry); store.collection = col;
 setStatus('Item added', 'success');
 currentPage = 1; renderCollection();
 } catch(e){
 setStatus('Add failed: ' + e.message, 'error');
 }
 }

 // Escaper
 function escapeHtml(s){
 return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 }

 // Expose API
window.login = login;
window.logout = function(){
 store.token = ''; store.user = '';
 const t = document.getElementById('token'); if (t) t.value = '';
 const u = document.getElementById('username'); if (u) u.value = '';
 showView('login'); setStatus('Signed out');
};
window.toggleCollection = toggleCollection;
window.clearSearch = clearSearch;
window.renderCollection = renderCollection;
window.openScan = openScan;
window.closeScan = closeScan;
window.searchBarcode = searchBarcode;
window.addRelease = addRelease;
window.showDetail = showDetail;
window.openRelease = openRelease;
window.setPage = setPage;
window.closeModal = closeModal;

// EINZIGER globaler Initialisierer
window.addEventListener('DOMContentLoaded', async () => {
 if (store.token && store.user) {
 const t = document.getElementById('token'); if (t) t.value = store.token;
 const u = document.getElementById('username'); if (u) u.value = store.user;
 const w = document.getElementById('welcome'); if (w) w.textContent = `welcome back: ${store.user}`;
 showView('loggedIn');
 await loadCollection();
 toggleCollection(true);
 }

 // Apply dark background for body
 if (document && document.body) {
 document.body.style.background = '#000000';
 }

 // --- UNIVERSAL R1 SCROLLWHEEL + KEY SUPPORT ---
 (function(){
 document.addEventListener('wheel', (e) => {
 e.preventDefault();
 if (e.deltaY < 0) window.dispatchEvent(new CustomEvent('scrollUp'));
 if (e.deltaY > 0) window.dispatchEvent(new CustomEvent('scrollDown'));
 });
 document.addEventListener('keydown', (e) => {
 if (e.code === 'ArrowUp') { e.preventDefault(); window.dispatchEvent(new CustomEvent('scrollUp')); }
 if (e.code === 'ArrowDown') { e.preventDefault(); window.dispatchEvent(new CustomEvent('scrollDown')); }
 });
 if (window.rabbit && typeof window.rabbit.onScroll === 'function') {
 window.rabbit.onScroll((delta) => {
 if (delta < 0) window.dispatchEvent(new CustomEvent('scrollUp'));
 if (delta > 0) window.dispatchEvent(new CustomEvent('scrollDown'));
 });
 }
 })();

 // Paging by custom events (debounced)
 let scrollLock = false;
 function unlockScroll() { scrollLock = false; }
 window.addEventListener('scrollUp', () => {
 if (scrollLock) return; scrollLock = true;
 setPage(currentPage - 1);
 setTimeout(unlockScroll, 150);
 });
 window.addEventListener('scrollDown', () => {
 if (scrollLock) return; scrollLock = true;
 setPage(currentPage + 1);
 setTimeout(unlockScroll, 150);
 });
});

})();

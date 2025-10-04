# Button-Funktionen Fehleranalyse und Lösung

## Problem
Die Buttons in index.html funktionieren nicht, weil:

### 1. ES6-Module-Scope-Problem
- Das `<script type="module">` erstellt einen isolierten Modul-Scope
- Funktionen sind NICHT im globalen Window-Scope verfügbar
- Buttons ohne Event-Listener können die Funktionen nicht aufrufen

### 2. Fehlende Event-Listener
Keine der Buttons hat programmat isch zugewiesene Event-Listener:
- `btn-auth` (Authentifizieren)
- `btn-logout` (Abmelden)
- `btn-refresh` (Refresh)
- `tabCollection`, `tabScanner`, `tabManualSearch` (Tabs)
- `scanner-toggle-btn`
- `btn-manual-search`

### 3. Undefinierte Funktionen
- `stopScanner()` wird in `showView()` aufgerufen, existiert aber nicht
- Scanner-Funktionalität fehlt komplett

## Lösung

### Änderungen im JavaScript-Bereich (nach den Funktionsdefinitionen):

```javascript
// WICHTIG: Scanner-Funktion hinzufügen
function stopScanner() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (codeReader) {
    codeReader.reset();
  }
  cameraStatus.textContent = 'Status: Stopped';
  scannerToggleBtn.textContent = 'Start Camera';
}

// EVENT LISTENERS - Am Ende des Scripts, ABER vor </script> hinzufügen:

// 1. Auth Buttons
document.getElementById('btn-auth').addEventListener('click', async () => {
  discogsToken = tokenInput.value.trim();
  discogsUsername = usernameInput.value.trim();
  if(!discogsToken || !discogsUsername) {
    showMessage('Bitte Token und Benutzername eingeben.', true);
    return;
  }
  localStorage.setItem('discogsToken', discogsToken);
  localStorage.setItem('discogsUsername', discogsUsername);
  showMessage('Erfolgreich authentifiziert!');
  await loadCollection();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('discogsToken');
  localStorage.removeItem('discogsUsername');
  discogsToken = '';
  discogsUsername = '';
  authView.classList.remove('hidden');
  mainContent.classList.add('hidden');
  showMessage('Abgemeldet.');
});

// 2. Refresh Button
document.getElementById('btn-refresh').addEventListener('click', () => {
  loadCollection();
});

// 3. Tab Navigation
document.getElementById('tabCollection').addEventListener('click', () => {
  showView('collection');
});

document.getElementById('tabScanner').addEventListener('click', () => {
  showView('scanner');
});

document.getElementById('tabManualSearch').addEventListener('click', () => {
  showView('manualSearch');
});

// 4. Scanner Toggle
document.getElementById('scanner-toggle-btn').addEventListener('click', async () => {
  if(mediaStream) {
    stopScanner();
  } else {
    // Scanner starten (vereinfachte Version)
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
      scannerVideo.srcObject = mediaStream;
      await scannerVideo.play();
      cameraStatus.textContent = 'Status: Running';
      scannerToggleBtn.textContent = 'Stop Camera';
    } catch(err) {
      showMessage('Kamera-Zugriff fehlgeschlagen', true);
      console.error(err);
    }
  }
});

// 5. Manual Search
document.getElementById('btn-manual-search').addEventListener('click', async () => {
  const query = manualQueryInput.value.trim();
  if(!query) {
    showMessage('Bitte Suchbegriff eingeben', true);
    return;
  }
  showMessage('Suche...');
  const url = `${API_BASE}/database/search?q=${encodeURIComponent(query)}&type=release&per_page=1`;
  const data = await discogsFetch(url);
  if(data && data.results && data.results.length > 0) {
    const result = data.results[0];
    currentSearchResult = result;
    resultTitleManual.textContent = `${result.title} (${result.year || 'N/A'})`;
    resultBoxManual.classList.remove('hidden');
    showMessage('Gefunden!');
  } else {
    showMessage('Nichts gefunden', true);
  }
});

// 6. Init: Bei Start prüfen ob bereits auth isiert
if(discogsToken && discogsUsername) {
  loadCollection();
}
```

## Zusammenfassung

**Hauptprobleme:**
1. ✗ ES6-Module isoliert Funktionen
2. ✗ Keine Event-Listener zugewiesen
3. ✗ `stopScanner()` nicht definiert

**Lösungen:**
1. ✓ Event-Listener programmatisch hinzufügen (nicht auf onclick-Attribute verlassen)
2. ✓ `stopScanner()` Funktion implementieren
3. ✓ Init-Code am Ende für Autoload bei bestehender Auth

## Rabbit R1 Kompatibilität

Diese Lösung ist Rabbit R1-kompatibel, weil:
- Standard-DOM-APIs verwendet werden
- Keine Framework-Abhängigkeiten
- Event-Listener statt globaler Funktionen
- `<script type="module">` bleibt erhalten (moderne Best Practice)

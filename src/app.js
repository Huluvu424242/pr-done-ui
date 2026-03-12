import './orbitdb.js';

const STORAGE_KEY = 'pr-done-orbitdb-config-v1';

const state = {
  config: null,
  events: []
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  configCard: $('#configCard'),
  configForm: $('#configForm'),
  teamName: $('#teamName'),
  userShortcode: $('#userShortcode'),
  dbAddressInput: $('#dbAddressInput'),
  createDbBtn: $('#createDbBtn'),
  copyDbBtn: $('#copyDbBtn'),
  resetConfigBtn: $('#resetConfigBtn'),
  prDoneBtn: $('#prDoneBtn'),
  refreshBtn: $('#refreshBtn'),
  runtimeStatus: $('#runtimeStatus'),
  teamLabel: $('#teamLabel'),
  userLabel: $('#userLabel'),
  dbNameLabel: $('#dbNameLabel'),
  peerIdLabel: $('#peerIdLabel'),
  orbitIdentityLabel: $('#orbitIdentityLabel'),
  writeAccessLabel: $('#writeAccessLabel'),
  dbAddressLabel: $('#dbAddressLabel'),
  actionFeedback: $('#actionFeedback'),
  totalEventsStat: $('#totalEventsStat'),
  topReviewerStat: $('#topReviewerStat'),
  topDayStat: $('#topDayStat'),
  myTodayStat: $('#myTodayStat'),
  chart: $('#chart'),
  eventsTableBody: $('#eventsTableBody'),
  dailySummaryBody: $('#dailySummaryBody')
};

function sanitizeTeamName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'team';
}

function normalizeShortcode(value) {
  return value.trim().toUpperCase();
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDbName(teamName) {
  return `prdone-${sanitizeTeamName(teamName)}`;
}

function loadConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.teamName || !parsed.userShortcode) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

function setStatus(message, isError = false) {
  elements.runtimeStatus.textContent = message;
  elements.runtimeStatus.style.color = isError ? 'var(--danger)' : 'var(--text)';
}

function setFeedback(message, isError = false) {
  elements.actionFeedback.textContent = message;
  elements.actionFeedback.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

function renderConfig(config) {
  const dbName = getDbName(config.teamName);
  elements.teamLabel.textContent = config.teamName;
  elements.userLabel.textContent = config.userShortcode;
  elements.dbNameLabel.textContent = dbName;
}

function renderDiagnostics(info) {
  elements.peerIdLabel.textContent = info.peerId || 'unbekannt';
  elements.orbitIdentityLabel.textContent = info.identityId || 'unbekannt';
  elements.dbAddressLabel.textContent = info.dbAddress || 'unbekannt';
  const writeAccess = Array.isArray(info.writeAccess) ? info.writeAccess.join(', ') : String(info.writeAccess || 'unbekannt');
  elements.writeAccessLabel.textContent = writeAccess;
}

function aggregateByDay(events) {
  const counts = new Map();
  for (const event of events) {
    counts.set(event.dayKey, (counts.get(event.dayKey) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function aggregateByReviewer(events) {
  const counts = new Map();
  for (const event of events) {
    counts.set(event.userShortcode, (counts.get(event.userShortcode) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function aggregateByDayAndReviewer(events) {
  const counts = new Map();
  for (const event of events) {
    const key = `${event.dayKey}__${event.userShortcode}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [dayKey, userShortcode] = key.split('__');
      return { dayKey, userShortcode, count };
    })
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey) || a.userShortcode.localeCompare(b.userShortcode));
}

function renderChart(events) {
  const daily = aggregateByDay(events);
  elements.chart.innerHTML = '';

  if (daily.length === 0) {
    elements.chart.innerHTML = '<p class="muted">Noch keine Daten vorhanden.</p>';
    return;
  }

  const max = Math.max(...daily.map(([, value]) => value), 1);

  for (const [day, value] of daily) {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML = `
      <strong>${day}</strong>
      <div class="chart-bar-wrap"><div class="chart-bar" style="width:${(value / max) * 100}%"></div></div>
      <span>${value}</span>
    `;
    elements.chart.appendChild(row);
  }
}

function renderEventTable(events) {
  elements.eventsTableBody.innerHTML = '';
  if (events.length === 0) {
    elements.eventsTableBody.innerHTML = '<tr><td colspan="6" class="muted">Noch keine Daten vorhanden.</td></tr>';
    return;
  }

  for (const event of [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(event.timestamp).toLocaleString('de-DE')}</td>
      <td>${event.dayKey}</td>
      <td>${event.userShortcode}</td>
      <td>${event.teamName}</td>
      <td>${event.type}</td>
      <td title="${event.hash}">${event.hash.slice(0, 18)}…</td>
    `;
    elements.eventsTableBody.appendChild(tr);
  }
}

function renderDailySummary(events) {
  const rows = aggregateByDayAndReviewer(events);
  elements.dailySummaryBody.innerHTML = '';
  if (rows.length === 0) {
    elements.dailySummaryBody.innerHTML = '<tr><td colspan="3" class="muted">Noch keine Daten vorhanden.</td></tr>';
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.dayKey}</td>
      <td>${row.userShortcode}</td>
      <td>${row.count}</td>
    `;
    elements.dailySummaryBody.appendChild(tr);
  }
}

function renderStats(events) {
  elements.totalEventsStat.textContent = String(events.length);

  const reviewerRanking = aggregateByReviewer(events);
  elements.topReviewerStat.textContent = reviewerRanking[0]
    ? `${reviewerRanking[0][0]} (${reviewerRanking[0][1]})`
    : '–';

  const dayRanking = aggregateByDay(events).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
  elements.topDayStat.textContent = dayRanking[0]
    ? `${dayRanking[0][0]} (${dayRanking[0][1]})`
    : '–';

  const today = getTodayKey();
  const mineToday = state.config
    ? events.filter((event) => event.dayKey === today && event.userShortcode === state.config.userShortcode).length
    : 0;
  elements.myTodayStat.textContent = String(mineToday);
}

function renderAll(events) {
  renderChart(events);
  renderEventTable(events);
  renderDailySummary(events);
  renderStats(events);
}

async function loadDbEvents() {
  const events = await window.prDoneOrbit.loadEvents();
  state.events = events;
  renderAll(events);
}

function showConfigForm(config = null) {
  elements.configCard.classList.remove('hidden');
  if (config) {
    elements.teamName.value = config.teamName || '';
    elements.userShortcode.value = config.userShortcode || '';
    elements.dbAddressInput.value = config.dbAddress || '';
  }
}

function hideConfigForm() {
  elements.configCard.classList.add('hidden');
}

async function initOrbit() {
  setStatus('Helia und OrbitDB werden initialisiert …');

  const result = await window.prDoneOrbit.init({
    config: state.config,
    getDbName,
    onStatus: setStatus,
    onEventWritten: (message) => setFeedback(message),
    onDbUpdated: async () => {
      await loadDbEvents();
    }
  });

  renderDiagnostics(result);
  setStatus('Bereit');
  elements.prDoneBtn.disabled = false;
  elements.refreshBtn.disabled = false;

  if (!state.config.dbAddress) {
    state.config.dbAddress = result.dbAddress;
    elements.dbAddressInput.value = result.dbAddress;
    saveConfig(state.config);
  }

  await loadDbEvents();
}

async function bootstrap() {
  state.config = loadConfig();

  if (!state.config) {
    setStatus('Konfiguration erforderlich');
    showConfigForm();
    return;
  }

  renderConfig(state.config);
  hideConfigForm();

  try {
    await initOrbit();
  } catch (error) {
    console.error(error);
    setStatus('Fehler bei der Initialisierung', true);
    setFeedback(error?.message || String(error), true);
    showConfigForm(state.config);
  }
}

// Konfigurationsformular: Werte übernehmen, lokal speichern und OrbitDB initialisieren
elements.configForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const config = {
    teamName: elements.teamName.value.trim(),
    userShortcode: normalizeShortcode(elements.userShortcode.value),
    dbAddress: elements.dbAddressInput.value.trim()
  };

  if (!config.teamName || !config.userShortcode) {
    setFeedback('Bitte Teamname und Namenskürzel ausfüllen.', true);
    return;
  }

  state.config = config;
  saveConfig(config);
  renderConfig(config);
  hideConfigForm();

  try {
    await initOrbit();
  } catch (error) {
    console.error(error);
    setStatus('Fehler bei der Initialisierung', true);
    setFeedback(error?.message || String(error), true);
    showConfigForm(config);
  }
});

// Button „OrbitDB erzeugen“: neue DB anlegen und Adresse ins Feld schreiben
elements.createDbBtn.addEventListener('click', async () => {
  const teamName = elements.teamName.value.trim();

  if (!teamName) {
    setFeedback('Bitte zuerst einen Teamnamen eintragen, damit eine passende OrbitDB erzeugt werden kann.', true);
    elements.teamName.focus();
    return;
  }

  elements.createDbBtn.disabled = true;
  setStatus('OrbitDB-Adresse wird erzeugt …');
  setFeedback('Initiale OrbitDB wird erstellt …');

  try {
    const result = await window.prDoneOrbit.createInitialDbAddress({
      teamName,
      getDbName,
      onStatus: setStatus
    });

    elements.dbAddressInput.value = result.dbAddress;
    elements.dbNameLabel.textContent = result.dbName;
    renderDiagnostics(result);

    setStatus('OrbitDB-Adresse erzeugt');
    setFeedback('Die gemeinsame OrbitDB-Adresse wurde erzeugt und ins Feld eingetragen. Jetzt kannst du sie per Click2Copy kopieren.');
  } catch (error) {
    console.error(error);
    setStatus('Fehler beim Erzeugen der OrbitDB', true);
    setFeedback(error?.message || String(error), true);
  } finally {
    elements.createDbBtn.disabled = false;
  }
});

// Button „Click2Copy“: DB-Adresse in die Zwischenablage kopieren
elements.copyDbBtn.addEventListener('click', async () => {
  const value = elements.dbAddressInput.value.trim();

  if (!value) {
    setFeedback('Es gibt noch keine OrbitDB-Adresse zum Kopieren.', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setFeedback('OrbitDB-Adresse in die Zwischenablage kopiert.');
  } catch (error) {
    console.error(error);
    setFeedback('Kopieren fehlgeschlagen. Bitte Adresse manuell markieren und kopieren.', true);
  }
});

// Button „PR done“: neues Event in die geöffnete OrbitDB schreiben
elements.prDoneBtn.addEventListener('click', async () => {
  elements.prDoneBtn.disabled = true;
  setFeedback('Event wird geschrieben …');

  try {
    await window.prDoneOrbit.addPrDoneEvent({
      teamName: state.config.teamName,
      userShortcode: state.config.userShortcode,
      dayKey: getTodayKey(),
      timestamp: new Date().toISOString()
    });

    await loadDbEvents();
  } catch (error) {
    console.error(error);
    const message = error?.message || String(error);
    const diagnostics = window.prDoneOrbit.getDbDiagnostics?.();
    if (String(message).includes('not allowed to write to the log')) {
      setFeedback(`Schreiben nicht erlaubt. Orbit-Identity: ${diagnostics?.identityId || 'unbekannt'} | Write-Access: ${Array.isArray(diagnostics?.writeAccess) ? diagnostics.writeAccess.join(', ') : 'unbekannt'}`, true);
    } else {
      setFeedback(message, true);
    }
  } finally {
    elements.prDoneBtn.disabled = false;
  }
});

elements.refreshBtn.addEventListener('click', async () => {
  elements.refreshBtn.disabled = true;
  try {
    await loadDbEvents();
    setFeedback('Daten neu geladen.');
  } catch (error) {
    console.error(error);
    const message = error?.message || String(error);
    const diagnostics = window.prDoneOrbit.getDbDiagnostics?.();
    if (String(message).includes('not allowed to write to the log')) {
      setFeedback(`Schreiben nicht erlaubt. Orbit-Identity: ${diagnostics?.identityId || 'unbekannt'} | Write-Access: ${Array.isArray(diagnostics?.writeAccess) ? diagnostics.writeAccess.join(', ') : 'unbekannt'}`, true);
    } else {
      setFeedback(message, true);
    }
  } finally {
    elements.refreshBtn.disabled = false;
  }
});

elements.resetConfigBtn.addEventListener('click', () => {
  clearConfig();
  window.location.reload();
});

bootstrap();

import './style.css'
import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { createLibp2p } from 'libp2p'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'

const STORAGE_KEY = 'pr-done-orbitdb-config'
const app = document.querySelector('#app')

let orbit = null
let db = null
let records = []

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function startOfLocalDay(dateLike = new Date()) {
  const date = new Date(dateLike)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dateString))
}

function formatDay(dayKey) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(`${dayKey}T00:00:00`))
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer()
  let binary = ''
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function setupOrbitDb(config) {
  if (orbit?.orbitdb && db) {
    return { orbitdb: orbit.orbitdb, db }
  }

  const teamSlug = slugify(config.teamName)
  const memberSlug = slugify(config.memberShort)
  const repoPrefix = `pr-done-${teamSlug}-${memberSlug}`

  const blockstore = new IDBBlockstore(`${repoPrefix}-blocks`)
  const datastore = new IDBDatastore(`${repoPrefix}-data`)

  const libp2p = await createLibp2p({
    datastore,
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true
      }),
      identify: identify()
    }
  })

  const ipfs = await createHelia({
    libp2p,
    blockstore,
    datastore
  })

  const orbitdb = await createOrbitDB({ ipfs })
  const openedDb = await orbitdb.open(`pr-done-${teamSlug}`, { type: 'events' })

  orbit = { ipfs, orbitdb, libp2p }
  db = openedDb

  if (db?.events?.on) {
    db.events.on('update', async () => {
      await refreshEvents()
    })
  }

  return { orbitdb, db: openedDb }
}

async function loadEntriesFromDb() {
  if (!db) return []

  if (typeof db.all === 'function') {
    const all = await db.all()
    if (Array.isArray(all)) {
      return all
    }
  }

  const fallback = []
  if (typeof db.iterator === 'function') {
    for await (const entry of db.iterator()) {
      fallback.push(entry)
    }
  }
  return fallback
}

function normalizeRecord(entry) {
  const value = entry?.value ?? entry?.payload?.value ?? entry
  return {
    id: entry?.hash ?? value?.eventId ?? crypto.randomUUID(),
    memberShort: value?.memberShort ?? '??',
    memberId: value?.memberId ?? 'unknown',
    teamName: value?.teamName ?? 'unbekannt',
    createdAt: value?.createdAt ?? new Date().toISOString(),
    dayKey: value?.dayKey ?? new Date().toISOString().slice(0, 10),
    count: Number(value?.count ?? 1)
  }
}

async function refreshEvents() {
  const entries = await loadEntriesFromDb()
  records = entries.map(normalizeRecord).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  renderDashboard()
}

function aggregateRecords() {
  const byMemberDay = new Map()
  const byMember = new Map()
  const byDay = new Map()

  for (const record of records) {
    const memberDayKey = `${record.memberShort}__${record.dayKey}`
    byMemberDay.set(memberDayKey, (byMemberDay.get(memberDayKey) ?? 0) + 1)
    byMember.set(record.memberShort, (byMember.get(record.memberShort) ?? 0) + 1)
    byDay.set(record.dayKey, (byDay.get(record.dayKey) ?? 0) + 1)
  }

  const memberDayRows = Array.from(byMemberDay.entries())
    .map(([key, total]) => {
      const [memberShort, dayKey] = key.split('__')
      return { memberShort, dayKey, total }
    })
    .sort((a, b) => (a.dayKey === b.dayKey ? a.memberShort.localeCompare(b.memberShort) : b.dayKey.localeCompare(a.dayKey)))

  const memberTotals = Array.from(byMember.entries())
    .map(([memberShort, total]) => ({ memberShort, total }))
    .sort((a, b) => b.total - a.total || a.memberShort.localeCompare(b.memberShort))

  const dayTotals = Array.from(byDay.entries())
    .map(([dayKey, total]) => ({ dayKey, total }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))

  return { memberDayRows, memberTotals, dayTotals }
}

function chartBars(dayTotals) {
  if (!dayTotals.length) {
    return '<p class="empty-state">Noch keine Events vorhanden.</p>'
  }

  const max = Math.max(...dayTotals.map((item) => item.total), 1)
  return dayTotals
    .map((item) => {
      const width = Math.max(8, Math.round((item.total / max) * 100))
      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(formatDay(item.dayKey))}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <div class="bar-value">${item.total}</div>
        </div>
      `
    })
    .join('')
}

function todaysDoneClass(config) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const didToday = records.some(
    (record) => record.memberId === config.memberId && record.dayKey === todayKey
  )
  return didToday ? 'status-dot is-green' : 'status-dot'
}

function renderConfigForm(existing = readConfig()) {
  const current = existing ?? {}

  app.innerHTML = `
    <div class="page">
      <section class="card hero">
        <div>
          <p class="eyebrow">OrbitDB Demo</p>
          <h1>PR Done</h1>
          <p class="lead">Ein kleines local-first Gerüst für GitHub Pages: Konfiguration im Local Storage, PR-Events in OrbitDB direkt im Browser und einfache Team-Auswertung.</p>
        </div>
      </section>

      <section class="card">
        <h2>Erstkonfiguration</h2>
        <p class="muted">Die Angaben werden lokal im Browser gespeichert. Die hochgeladene Schlüsseldatei wird in dieser Demo nur lokal abgelegt und zur Ableitung einer stabilen Team-Identität genutzt.</p>

        <form id="config-form" class="stack">
          <label>
            <span>Teamname</span>
            <input name="teamName" required maxlength="80" value="${escapeHtml(current.teamName ?? '')}" placeholder="z. B. Team Phoenix" />
          </label>

          <label>
            <span>Namenskürzel</span>
            <input name="memberShort" required maxlength="12" value="${escapeHtml(current.memberShort ?? '')}" placeholder="z. B. TS" />
          </label>

          <label>
            <span>Schlüsseldatei</span>
            <input name="keyFile" type="file" ${current.keyFileName ? '' : 'required'} />
          </label>

          <div class="inline-note">
            Aktuell gespeichert: <strong>${escapeHtml(current.keyFileName ?? 'keine Datei')}</strong>
          </div>

          <button type="submit">Konfiguration speichern</button>
        </form>
      </section>
    </div>
  `

  const form = document.querySelector('#config-form')
  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const formData = new FormData(form)
    const teamName = String(formData.get('teamName') ?? '').trim()
    const memberShort = String(formData.get('memberShort') ?? '').trim().toUpperCase()
    const file = form.querySelector('input[name="keyFile"]').files?.[0] ?? null

    if (!teamName || !memberShort) {
      window.alert('Bitte Teamname und Namenskürzel ausfüllen.')
      return
    }

    let keyFileName = current.keyFileName ?? ''
    let keyFileBase64 = current.keyFileBase64 ?? ''

    if (file) {
      keyFileName = file.name
      keyFileBase64 = await fileToBase64(file)
    }

    if (!keyFileBase64) {
      window.alert('Bitte eine Schlüsseldatei auswählen.')
      return
    }

    const memberIdSeed = `${teamName}|${memberShort}|${keyFileName}|${keyFileBase64}`
    const memberId = await sha256Hex(memberIdSeed)

    saveConfig({
      teamName,
      memberShort,
      memberId,
      keyFileName,
      keyFileBase64,
      savedAt: new Date().toISOString()
    })

    await boot()
  })
}

function renderDashboard() {
  const config = readConfig()
  if (!config) {
    renderConfigForm()
    return
  }

  const { memberDayRows, memberTotals, dayTotals } = aggregateRecords()
  const topMember = memberTotals[0]
  const busiestDay = [...dayTotals].sort((a, b) => b.total - a.total || a.dayKey.localeCompare(b.dayKey))[0]
  const ownTotal = memberTotals.find((item) => item.memberShort === config.memberShort)?.total ?? 0

  app.innerHTML = `
    <div class="page">
      <section class="card hero hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(config.teamName)}</p>
          <h1>PR Done</h1>
          <p class="lead">Tracke PR-Reviews als Event-Log in OrbitDB. Jeder Klick auf <strong>PR done</strong> erzeugt einen neuen Eintrag im append-only Event-Store.</p>
        </div>
        <div class="identity-box">
          <div class="avatar">${escapeHtml(config.memberShort)}</div>
          <div>
            <div class="identity-line">
              <span class="${todaysDoneClass(config)}"></span>
              <strong>${escapeHtml(config.memberShort)}</strong>
            </div>
            <div class="muted small">Schlüsseldatei: ${escapeHtml(config.keyFileName)}</div>
          </div>
        </div>
      </section>

      <section class="actions-grid">
        <button id="pr-done-btn" class="primary big">PR done</button>
        <button id="reset-config-btn" class="secondary">Konfiguration löschen</button>
      </section>

      <section class="stats-grid">
        <article class="card stat-card">
          <span class="stat-label">Deine Reviews</span>
          <strong class="stat-value">${ownTotal}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Gesamt-Events</span>
          <strong class="stat-value">${records.length}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Top Reviewer</span>
          <strong class="stat-value">${escapeHtml(topMember ? `${topMember.memberShort} (${topMember.total})` : '—')}</strong>
        </article>
        <article class="card stat-card">
          <span class="stat-label">Stärkster Tag</span>
          <strong class="stat-value">${escapeHtml(busiestDay ? `${formatDay(busiestDay.dayKey)} · ${busiestDay.total}` : '—')}</strong>
        </article>
      </section>

      <section class="content-grid">
        <article class="card">
          <h2>Reviews pro Tag</h2>
          <div class="bar-chart">${chartBars(dayTotals)}</div>
        </article>

        <article class="card">
          <h2>Reviewer-Ranking</h2>
          <table>
            <thead>
              <tr><th>Mitarbeiter</th><th>Reviews</th></tr>
            </thead>
            <tbody>
              ${memberTotals.length
                ? memberTotals
                    .map(
                      (item) => `
                        <tr>
                          <td>${escapeHtml(item.memberShort)}</td>
                          <td>${item.total}</td>
                        </tr>
                      `
                    )
                    .join('')
                : '<tr><td colspan="2">Noch keine Daten vorhanden.</td></tr>'}
            </tbody>
          </table>
        </article>
      </section>

      <section class="card">
        <h2>Reviews je Mitarbeiter und Tag</h2>
        <table>
          <thead>
            <tr><th>Tag</th><th>Mitarbeiter</th><th>Anzahl</th></tr>
          </thead>
          <tbody>
            ${memberDayRows.length
              ? memberDayRows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(formatDay(row.dayKey))}</td>
                        <td>${escapeHtml(row.memberShort)}</td>
                        <td>${row.total}</td>
                      </tr>
                    `
                  )
                  .join('')
              : '<tr><td colspan="3">Noch keine Events vorhanden.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Rohdaten</h2>
        <table>
          <thead>
            <tr><th>Zeitpunkt</th><th>Mitarbeiter</th><th>Team</th><th>Event-ID</th></tr>
          </thead>
          <tbody>
            ${records.length
              ? records
                  .map(
                    (record) => `
                      <tr>
                        <td>${escapeHtml(formatDate(record.createdAt))}</td>
                        <td>${escapeHtml(record.memberShort)}</td>
                        <td>${escapeHtml(record.teamName)}</td>
                        <td class="mono">${escapeHtml(record.id)}</td>
                      </tr>
                    `
                  )
                  .join('')
              : '<tr><td colspan="4">Noch keine Events vorhanden.</td></tr>'}
          </tbody>
        </table>
      </section>
    </div>
  `

  document.querySelector('#pr-done-btn')?.addEventListener('click', addPrDoneEvent)
  document.querySelector('#reset-config-btn')?.addEventListener('click', async () => {
    localStorage.removeItem(STORAGE_KEY)
    records = []
    renderConfigForm()
  })
}

async function addPrDoneEvent() {
  const config = readConfig()
  if (!config) {
    renderConfigForm()
    return
  }

  await setupOrbitDb(config)

  const now = new Date()
  const payload = {
    eventId: crypto.randomUUID(),
    eventType: 'pr-done',
    teamName: config.teamName,
    memberShort: config.memberShort,
    memberId: config.memberId,
    dayKey: now.toISOString().slice(0, 10),
    createdAt: now.toISOString()
  }

  await db.add(payload)
  await refreshEvents()
}

async function boot() {
  const config = readConfig()
  if (!config) {
    renderConfigForm()
    return
  }

  app.innerHTML = `
    <div class="page">
      <section class="card hero">
        <p class="eyebrow">${escapeHtml(config.teamName)}</p>
        <h1>PR Done</h1>
        <p class="lead">OrbitDB wird initialisiert …</p>
      </section>
    </div>
  `

  try {
    await setupOrbitDb(config)
    await refreshEvents()
  } catch (error) {
    console.error(error)
    app.innerHTML = `
      <div class="page">
        <section class="card">
          <h1>Initialisierung fehlgeschlagen</h1>
          <p>Die OrbitDB-/Helia-Initialisierung konnte nicht abgeschlossen werden.</p>
          <pre class="error-box">${escapeHtml(error?.stack ?? error?.message ?? String(error))}</pre>
          <button id="retry-btn">Erneut versuchen</button>
        </section>
      </div>
    `
    document.querySelector('#retry-btn')?.addEventListener('click', () => {
      boot()
    })
  }
}

boot()

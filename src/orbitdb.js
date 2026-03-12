const orbitState = {
  ipfs: null,
  orbitdb: null,
  db: null,
  dbUpdateListenerAttached: false
};

function getPeerId() {
  return orbitState.ipfs?.libp2p?.peerId?.toString?.() || 'unbekannt';
}

function getIdentityId() {
  return orbitState.orbitdb?.identity?.id || 'unbekannt';
}

function getWriteAccessList(db) {
  try {
    const write = db?.access?.write;
    if (Array.isArray(write)) {
      return write;
    }
  } catch {}
  return ['unbekannt'];
}

function getDbDiagnostics() {
  return {
    peerId: getPeerId(),
    identityId: getIdentityId(),
    dbAddress: orbitState.db ? String(orbitState.db.address) : 'unbekannt',
    writeAccess: orbitState.db ? getWriteAccessList(orbitState.db) : ['unbekannt']
  };
}

async function ensureOrbitRuntime() {
  if (orbitState.ipfs && orbitState.orbitdb) {
    return;
  }

  const { createHelia, libp2pDefaults } = window.Helia;
  const { createOrbitDB } = window.OrbitDB;
  const { gossipsub } = window.ChainsafeLibp2PGossipsub;

  const libp2pOptions = libp2pDefaults();
  libp2pOptions.services.pubsub = gossipsub({ allowPublishToZeroTopicPeers: true });

  orbitState.ipfs = await createHelia({ libp2p: libp2pOptions });
  orbitState.orbitdb = await createOrbitDB({ ipfs: orbitState.ipfs });
}

async function openEventsDb(target) {
  return await orbitState.orbitdb.open(target, {
    type: 'events',
    syncAutomatically: true,
    accessController: {
      write: ['*']
    }
  });
}

function attachDbUpdateListener(db, onDbUpdated) {
  if (orbitState.dbUpdateListenerAttached || !onDbUpdated) {
    return;
  }

  db.events.on('update', async () => {
    await onDbUpdated();
  });

  orbitState.dbUpdateListenerAttached = true;
}

function mapEventRows(rows) {
  return rows
    .map((entry) => ({
      hash: entry.hash,
      ...(entry.value || {})
    }))
    .filter((value) => value && value.type === 'pr_done');
}

async function init({ config, getDbName, onStatus, onDbUpdated }) {
  onStatus?.('Helia und OrbitDB werden initialisiert …');

  await ensureOrbitRuntime();

  const target = config.dbAddress?.trim() || getDbName(config.teamName);

  if (!orbitState.db || String(orbitState.db.address) !== target) {
    orbitState.db = await openEventsDb(target);
    orbitState.dbUpdateListenerAttached = false;
    attachDbUpdateListener(orbitState.db, onDbUpdated);
  }

  return getDbDiagnostics();
}

async function createInitialDbAddress({ teamName, getDbName, onStatus }) {
  onStatus?.('OrbitDB-Adresse wird erzeugt …');
  await ensureOrbitRuntime();

  const dbName = getDbName(teamName);
  const db = await openEventsDb(dbName);

  orbitState.db = db;
  orbitState.dbUpdateListenerAttached = false;

  return {
    dbName,
    ...getDbDiagnostics()
  };
}

async function loadEvents() {
  if (!orbitState.db) {
    return [];
  }

  const rows = await orbitState.db.all();
  return mapEventRows(rows);
}

async function addPrDoneEvent({ teamName, userShortcode, dayKey, timestamp }) {
  if (!orbitState.db) {
    throw new Error('Die OrbitDB ist noch nicht geöffnet.');
  }

  const payload = {
    type: 'pr_done',
    teamName,
    userShortcode,
    timestamp,
    dayKey
  };

  const hash = await orbitState.db.add(payload);
  return hash;
}

window.prDoneOrbit = {
  init,
  createInitialDbAddress,
  loadEvents,
  addPrDoneEvent,
  getDbDiagnostics
};

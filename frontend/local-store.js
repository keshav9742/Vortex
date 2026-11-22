const DB_NAME = 'trace-local-first';
const DB_VERSION = 1;
const ANALYSES = 'analyses';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANALYSES)) {
        const store = db.createObjectStore(ANALYSES, { keyPath: 'id' });
        store.createIndex('owner', 'owner', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local storage could not be opened.'));
  });
}

function requestTransaction(mode, action) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(ANALYSES, mode);
    const result = action(tx.objectStore(ANALYSES));
    tx.oncomplete = () => { db.close(); resolve(result?.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Local data operation failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Local data operation was aborted.')); };
  }));
}

export async function listAnalyses(owner) {
  return requestTransaction('readonly', store => {
    const request = store.index('owner').getAll(owner);
    request.onsuccess = () => { request.result.sort((a, b) => a.platform.localeCompare(b.platform)); };
    return request;
  });
}

export async function saveAnalysis(owner, analysis) {
  const record = { ...analysis, owner, id: `${owner}:${analysis.platform}`, savedAt: Date.now() };
  await requestTransaction('readwrite', store => store.put(record));
  return record;
}

export async function removeAnalysis(owner, platform) {
  return requestTransaction('readwrite', store => store.delete(`${owner}:${platform}`));
}

export async function clearAnalyses(owner) {
  const records = await listAnalyses(owner);
  await requestTransaction('readwrite', store => {
    records.forEach(record => store.delete(record.id));
  });
}

export async function clearAllLocalData() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ANALYSES, 'readwrite');
    tx.objectStore(ANALYSES).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not clear local data.'));
  });
  db.close();
}

export async function migrateLegacyAnalyses(owner) {
  const key = `traceAnalyses:${owner}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw);
    if (Array.isArray(legacy)) for (const analysis of legacy) await saveAnalysis(owner, analysis);
  } finally {
    localStorage.removeItem(key);
  }
}

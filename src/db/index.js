import initSqlJs from 'sql.js'
import { get, set } from 'idb-keyval'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const DB_KEY = 'clinic_db_sqljs_v1'

// Fixed-file backup (File System Access API)
const BACKUP_HANDLE_KEY = 'clinic_backup_handle_v1'
let _backupHandle = null

let SQL = null
let db = null

export async function openDb() {
  try {
    if (!SQL) {
      // Use local-bundled WASM to avoid CDN/CORS issues
      SQL = await initSqlJs({ locateFile: () => wasmUrl })
    }

    // Try to restore previously chosen backup handle (if any)
    await initBackupHandle()

    const saved = await get(DB_KEY)
    if (saved) {
      db = new SQL.Database(new Uint8Array(saved))
    } else {
      db = new SQL.Database()
      db.run(schemaDDL)
      await persist()
    }
    return db
  } catch (err) {
    console.error('sql.js init error:', err)
    throw err
  }
}

/** Write the DB to IndexedDB and, if configured, also to the fixed file */
export async function persist() {
  if (!db) return
  const data = db.export()
  await set(DB_KEY, data)
  await writeBackupToFile(data) // no-op if no handle
}

export function exec(sql, params = {}) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

/** Mutating statement + persist */
export function run(sql, params = {}) {
  const stmt = db.prepare(sql)
  stmt.run(params)
  stmt.free()
  return persist()
}

/** Download a copy immediately */
export function exportFile() {
  const data = db.export()
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `clinic_${new Date().toISOString().slice(0,10)}.sqljs`
  a.click()
}

/* ---------------- Fixed-file backup helpers ---------------- */

export async function initBackupHandle() {
  try {
    const h = await get(BACKUP_HANDLE_KEY)
    if (!h) return
    // Request/confirm permission
    const perm = await h.queryPermission?.({ mode: 'readwrite' })
    if (perm === 'granted' || (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted') {
      _backupHandle = h
    }
  } catch (e) {
    console.warn('initBackupHandle failed:', e)
  }
}

export async function chooseBackupFile() {
  if (!('showSaveFilePicker' in window)) {
    alert('Tu navegador no soporta guardar directo en archivo. Usa "Respaldo inmediato".')
    return
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: 'clinic.sqlite',
    types: [{ description: 'SQLite database', accept: { 'application/octet-stream': ['.sqlite', '.db'] } }],
    excludeAcceptAllOption: false,
  })
  const perm = await handle.requestPermission?.({ mode: 'readwrite' })
  if (perm !== 'granted') {
    alert('No se otorgó permiso de escritura para el archivo de respaldo.')
    return
  }
  _backupHandle = handle
  await set(BACKUP_HANDLE_KEY, handle)
  // Write an immediate copy so the file is up to date
  await persist()
}

export async function hasBackupFile() {
  if (_backupHandle) return true
  try {
    const h = await get(BACKUP_HANDLE_KEY)
    if (!h) return false
    const perm = await h.queryPermission?.({ mode: 'readwrite' })
    if (perm === 'granted' || (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted') {
      _backupHandle = h
      return true
    }
  } catch {}
  return false
}

async function writeBackupToFile(bytes) {
  if (!_backupHandle) return
  try {
    const writable = await _backupHandle.createWritable()
    await writable.write(bytes)
    await writable.close()
  } catch (e) {
    console.warn('Error escribiendo respaldo fijo:', e)
  }
}

/** Force an immediate persist (used on section toggle) */
export async function persistNow() {
  await persist()
}

/* ---------------- Schema ---------------- */

const schemaDDL = `
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  sex TEXT,
  birth_date TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_doc ON patients(document_type, document_number);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  cas_code TEXT,
  encounter_type TEXT NOT NULL,
  objective TEXT,
  occurred_at TEXT NOT NULL,
  chief_complaint TEXT,
  hpi TEXT,
  antecedentes TEXT,
  physical_exam TEXT,
  vitals_json TEXT,
  impression TEXT,
  plan TEXT,
  status TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);

CREATE TABLE IF NOT EXISTS diagnoses (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  diagnosis_type TEXT,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  active_ingredient TEXT NOT NULL,
  trade_name TEXT,
  presentation TEXT,
  concentration TEXT,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  duration_days INTEGER,
  quantity_total TEXT,
  repeats INTEGER,
  indications TEXT,
  warnings TEXT,
  substitution_allowed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);

CREATE TABLE IF NOT EXISTS procedures (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  technique TEXT,
  anatomical_site TEXT,
  materials TEXT,
  dose_per_site TEXT,
  lot_number TEXT,
  lot_expiry TEXT,
  responsible TEXT,
  complications TEXT,
  post_observation TEXT,
  consent_obtained INTEGER,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  encounter_id TEXT,
  attachment_type TEXT,
  title TEXT,
  file_name TEXT,
  file_data BLOB,
  uploaded_at TEXT NOT NULL,
  author TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);
`

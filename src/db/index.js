// src/db/index.js
import initSqlJs from 'sql.js';
import { get, set } from 'idb-keyval';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_KEY = 'clinic_db_sqljs_v1';
const BACKUP_HANDLE_KEY = 'clinic_db_backup_handle_v1';

let SQL = null;
let db = null;
let backupHandle = null;

// Session state
let currentUser = null;
let currentKey = null; // CryptoKey (AES-GCM)

/** 
 * Open (or create) the DB. 
 * If running in Electron with Auth, loads encrypted file.
 * If running in Browser, uses IndexedDB (no encryption for now, or fallback).
 */
export async function openDb(username = null, encryptionKey = null) {
  try {
    console.log('openDb: starting, username=', username, 'hasKey=', !!encryptionKey);

    // If DB is already initialized and no specific user is provided, don't re-initialize
    if (db && !username) {
      console.log('openDb: DB already initialized, skipping re-init');
      return db;
    }

    if (!SQL) {
      console.log('openDb: initializing SQL.js');
      SQL = await initSqlJs({ locateFile: () => wasmUrl });
      console.log('openDb: SQL.js initialized');
    }

    currentUser = username;
    currentKey = encryptionKey;

    let data = null;

    // 1. Try loading from File API (Electron)
    if (window.dbFileApi && username) {
      console.log('openDb: trying to load from file API');
      const encryptedBytes = await window.dbFileApi.loadDbBytes(username);
      if (encryptedBytes) {
        console.log('openDb: loaded encrypted data, size=', encryptedBytes.length);
        // Decrypt
        data = await decryptData(encryptedBytes, encryptionKey);
        console.log('openDb: decrypted data, size=', data.length);
      } else {
        console.log('openDb: no existing DB file for user');
      }
    }
    // 2. Fallback to IndexedDB (Browser / Dev without Auth)
    else if (!window.dbFileApi) {
      console.log('openDb: using IndexedDB fallback');
      // Load backup handle
      try {
        backupHandle = await get(BACKUP_HANDLE_KEY);
      } catch {
        backupHandle = null;
      }
      data = await get(DB_KEY);
    }

    if (data) {
      console.log('openDb: loading existing database');
      db = new SQL.Database(new Uint8Array(data));
      await migrate();
      // Persist after migration if needed
      persist().catch(err => console.error('openDb: persist after load failed', err));
    } else {
      console.log('openDb: creating new database');
      db = new SQL.Database();
      db.run(schemaDDL);
      console.log('openDb: schema created, persisting...');
      // For new DB, persist in background to avoid blocking
      persist().catch(err => console.error('openDb: initial persist failed', err));
    }

    console.log('openDb: completed successfully');
    return db;
  } catch (err) {
    console.error("openDb failed", err);
    throw err;
  }
}

/** Encrypt/Decrypt Helpers */
async function encryptData(dataUint8, key) {
  console.log('encryptData: starting, dataSize=', dataUint8.length, 'hasKey=', !!key);
  if (!key) {
    console.log('encryptData: no key, returning plain data');
    return dataUint8;
  }
  console.log('encryptData: generating IV');
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  console.log('encryptData: encrypting with AES-GCM');
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    dataUint8
  );
  console.log('encryptData: encryption complete, size=', encrypted.byteLength);

  // Combine IV + Encrypted Data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  console.log('encryptData: combined data, final size=', combined.length);
  return combined;
}

async function decryptData(dataUint8, key) {
  if (!key) return dataUint8;
  // Extract IV (first 12 bytes)
  const iv = dataUint8.slice(0, 12);
  const ciphertext = dataUint8.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  return new Uint8Array(decrypted);
}

/** Persist DB */
async function persist() {
  if (!db) {
    console.log('persist: no db, returning');
    return;
  }
  try {
    console.log('persist: starting, currentUser=', currentUser, 'hasKey=', !!currentKey);
    console.log('persist: exporting database...');
    const data = db.export(); // Uint8Array
    console.log('persist: exported data, size=', data.length);

    // 1. Electron File Persistence
    if (window.dbFileApi && currentUser && currentKey) {
      console.log('persist: using Electron file API');
      console.log('persist: calling encryptData...');
      const encrypted = await encryptData(data, currentKey);
      console.log('persist: encrypted, size=', encrypted.length);
      console.log('persist: calling saveDbBytes...');
      await window.dbFileApi.saveDbBytes(currentUser, encrypted);
      console.log('persist: saveDbBytes completed successfully');
    }
    // 2. Browser IndexedDB Persistence
    else if (!window.dbFileApi) {
      console.log('persist: using IndexedDB');
      await set(DB_KEY, data);
      if (backupHandle) {
        try {
          await writeBackupFile(data);
        } catch (e) {
          console.warn('Backup file write failed:', e);
        }
      }
      console.log('persist: IndexedDB save complete');
    } else {
      console.log('persist: skipping (no currentUser or currentKey)');
    }
    console.log('persist: completed');
  } catch (err) {
    console.error('persist: FAILED with error', err);
    console.error('persist: error stack', err.stack);
    // Don't throw - just log
  }
}

/** Allow callers to force a persist (used on section toggles etc.). */
export async function persistNow() {
  return persist();
}

/** Read-only SELECT helper. Returns array of row objects. */
export function exec(sql, params = {}) {
  if (!db) return [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Run mutation (INSERT/UPDATE/DELETE). Persists afterwards. */
export function run(sql, params) {
  if (!db) return;
  const res = db.run(sql, params);
  // Persist in background to avoid blocking UI
  persist().catch(err => console.error('run: persist failed', err));
  return res;
}

/** Download a copy of the DB as a file (manual export). */
export function exportFile() {
  if (!db) return;
  const data = db.export();
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `clinic_${new Date().toISOString().slice(0, 10)}.sqljs`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Ask the user for a fixed backup file path, then write current DB immediately. */
export async function chooseBackupFile() {
  if (!('showSaveFilePicker' in window)) {
    console.warn('El navegador no soporta elegir archivo fijo. Usando descarga manual.');
    exportFile();
    return false;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'clinic_db.sqljs',
      types: [{
        description: 'Base de datos (sql.js)',
        accept: { 'application/octet-stream': ['.sqljs'] },
      }],
    });
    backupHandle = handle;
    await set(BACKUP_HANDLE_KEY, handle);
    await persist(); // write immediately
    return true;
  } catch (e) {
    // user cancelled or denied permission
    console.warn('chooseBackupFile cancelled/failed:', e);
    return false;
  }
}

/** True if there’s a previously chosen backup file handle (may still fail on write if permission revoked). */
export async function hasBackupFile() {
  return !!backupHandle;
}

/* ---------- internals ---------- */

async function writeBackupFile(uint8) {
  // Request permission if needed
  const ok = await verifyPermission(backupHandle, /* readWrite */ true);
  if (!ok) throw new Error('No hay permiso para escribir el archivo de respaldo.');

  const writable = await backupHandle.createWritable();
  // Make sure we overwrite the file completely
  await writable.truncate(0);
  await writable.write(new Blob([uint8], { type: 'application/octet-stream' }));
  await writable.close();
}

async function verifyPermission(fileHandle, readWrite = false) {
  try {
    const opts = readWrite ? { mode: 'readwrite' } : {};
    if (fileHandle.queryPermission) {
      const q = await fileHandle.queryPermission(opts);
      if (q === 'granted') return true;
    }
    if (fileHandle.requestPermission) {
      const r = await fileHandle.requestPermission(opts);
      return r === 'granted';
    }
  } catch (e) {
    // Some environments may not implement these; let write attempt fail loudly instead.
    console.warn('verifyPermission:', e);
  }
  return false;
}

/** One-shot, idempotent migrations for older DBs (adds new encounter fields). */
async function migrate() {
  const cols = exec(`PRAGMA table_info(encounters)`);
  const names = cols.map(c => c.name);
  if (!names.includes('finalidad_consulta')) {
    db.run(`ALTER TABLE encounters ADD COLUMN finalidad_consulta TEXT`);
  }
  if (!names.includes('causa_externa')) {
    db.run(`ALTER TABLE encounters ADD COLUMN causa_externa TEXT`);
  }
  if (!names.includes('procedures_notes')) {
    db.run(`ALTER TABLE encounters ADD COLUMN procedures_notes TEXT`);
  }

  // Procedures migration
  const procCols = exec(`PRAGMA table_info(procedures)`);
  const procNames = procCols.map(c => c.name);
  if (!procNames.includes('description')) {
    db.run(`ALTER TABLE procedures ADD COLUMN description TEXT`);
  }
  if (!procNames.includes('notes')) {
    db.run(`ALTER TABLE procedures ADD COLUMN notes TEXT`);
  }

  // Create procedure_attachments if missing
  db.run(`
    CREATE TABLE IF NOT EXISTS procedure_attachments (
      id TEXT PRIMARY KEY,
      procedure_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL, -- Base64
      type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE CASCADE
    )
  `);

  // Create settings table if missing
  const tables = exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`);
  if (tables.length === 0) {
    db.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`);
  }
}

/* ---------- initial schema (used for fresh DBs) ---------- */
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
  finalidad_consulta TEXT,   -- new
  causa_externa TEXT,        -- new
  procedures_notes TEXT,     -- new
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
  description TEXT,
  notes TEXT,
  consent_obtained INTEGER,
  -- Legacy fields (kept for schema compatibility if needed, but unused in new UI)
  technique TEXT,
  anatomical_site TEXT,
  materials TEXT,
  dose_per_site TEXT,
  lot_number TEXT,
  lot_expiry TEXT,
  responsible TEXT,
  complications TEXT,
  post_observation TEXT,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);

CREATE TABLE IF NOT EXISTS procedure_attachments (
  id TEXT PRIMARY KEY,
  procedure_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL, -- Base64
  type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS doctor_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  medical_license TEXT,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_data TEXT, -- Base64
  signature_data TEXT, -- Base64
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export default {
  openDb,
  exec,
  run,
  exportFile,
  chooseBackupFile,
  hasBackupFile,
  persistNow,
};

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const NAMESPACE_FILES = Object.freeze({
  'runtime-settings': process.env.RUNTIME_SETTINGS_FILE || path.join(DATA_DIR, 'runtime-settings.json'),
  'group-security': process.env.GROUP_SECURITY_FILE || path.join(DATA_DIR, 'group-security.json'),
  'process-control': process.env.PROCESS_CONTROL_FILE || path.join(DATA_DIR, 'process-control.json')
})
const NAMESPACES = Object.keys(NAMESPACE_FILES)
const values = new Map()
let backend = 'local-json'
let pool = null
let initialization = null
let writeQueue = Promise.resolve()

function assertNamespace(namespace) {
  if (!Object.hasOwn(NAMESPACE_FILES, namespace)) {
    throw new TypeError(`Unknown settings namespace: ${namespace}`)
  }
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function readLocal(namespace) {
  try {
    return normalizeObject(JSON.parse(fs.readFileSync(NAMESPACE_FILES[namespace], 'utf8')))
  } catch {
    return {}
  }
}

function writeLocal(namespace, value) {
  const filename = NAMESPACE_FILES[namespace]
  const directory = path.dirname(filename)
  fs.mkdirSync(directory, { recursive: true })
  const temporary = `${filename}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 })
  fs.renameSync(temporary, filename)
}

function parseJsonb(value) {
  if (typeof value === 'string') {
    try { return normalizeObject(JSON.parse(value)) } catch { return {} }
  }
  return normalizeObject(value)
}

async function initialize() {
  if (process.env.DATABASE_URL) {
    let candidatePool
    try {
      const { Pool } = await import('pg')
      candidatePool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000
      })
      await candidatePool.query(`
        CREATE TABLE IF NOT EXISTS ultra_guru_settings (
          namespace TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      const result = await candidatePool.query('SELECT namespace, payload FROM ultra_guru_settings')
      const existing = new Map(result.rows.map(row => [row.namespace, parseJsonb(row.payload)]))

      for (const namespace of NAMESPACES) {
        if (existing.has(namespace)) {
          values.set(namespace, existing.get(namespace))
          continue
        }
        const migrated = readLocal(namespace)
        await candidatePool.query(
          `INSERT INTO ultra_guru_settings (namespace, payload, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (namespace) DO NOTHING`,
          [namespace, JSON.stringify(migrated)]
        )
        values.set(namespace, migrated)
      }
      pool = candidatePool
      backend = 'postgres'
      console.log('[SETTINGS] Loaded durable settings from PostgreSQL.')
      return backend
    } catch (error) {
      if (candidatePool) {
        try { await candidatePool.end() } catch {}
      }
      backend = 'local-json'
      console.error(`[SETTINGS] PostgreSQL is unavailable${error?.code ? ` (${error.code})` : ''}; using local JSON files. On Heroku, local settings are lost when the dyno restarts. Configure a working DATABASE_URL for durable settings.`)
    }
  }

  for (const namespace of NAMESPACES) {
    if (!values.has(namespace)) values.set(namespace, readLocal(namespace))
  }
  return backend
}

export function initializePersistentSettings() {
  if (!initialization) initialization = initialize()
  return initialization
}

export async function bindSettingsToSession(sessionId) {
  const normalizedSession = String(sessionId || '').trim()
  if (!normalizedSession) return { changed: false, bound: false }
  await initializePersistentSettings()
  const fingerprint = createHash('sha256').update(normalizedSession).digest('hex')
  const control = readSettingsNamespace('process-control')
  if (control.sessionFingerprint && control.sessionFingerprint !== fingerprint) {
    await writeSettingsNamespace('runtime-settings', {})
    await writeSettingsNamespace('group-security', {})
    await writeSettingsNamespace('process-control', { sessionFingerprint: fingerprint })
    console.log('[SETTINGS] WhatsApp session ID changed; cleared saved settings for the previous linked account.')
    return { changed: true, bound: true }
  }
  if (!control.sessionFingerprint) {
    await writeSettingsNamespace('process-control', { ...control, sessionFingerprint: fingerprint })
  }
  return { changed: false, bound: true }
}

export function readSettingsNamespace(namespace) {
  assertNamespace(namespace)
  if (!values.has(namespace)) values.set(namespace, readLocal(namespace))
  return values.get(namespace)
}

export function writeSettingsNamespace(namespace, value) {
  assertNamespace(namespace)
  const snapshot = normalizeObject(JSON.parse(JSON.stringify(value)))
  values.set(namespace, snapshot)

  if (backend !== 'postgres' || !pool) {
    writeLocal(namespace, snapshot)
    return Promise.resolve(snapshot)
  }

  const serialized = JSON.stringify(snapshot)
  const pending = writeQueue.catch(() => {}).then(() => pool.query(
    `INSERT INTO ultra_guru_settings (namespace, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (namespace) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [namespace, serialized]
  )).then(() => snapshot)
  writeQueue = pending
  return pending
}

export async function flushPersistentSettings() {
  await writeQueue
}

export function getSettingsStorageStatus() {
  return {
    backend,
    durable: backend === 'postgres',
    databaseConfigured: Boolean(process.env.DATABASE_URL)
  }
}

export async function closePersistentSettings() {
  await flushPersistentSettings()
  if (pool) {
    const currentPool = pool
    pool = null
    await currentPool.end()
  }
}

/**
 * migrate.js — Automatic Database Migration Runner
 * -------------------------------------------------
 * Runs on every server start. Discovers all .sql files in the
 * /migrations directory, executes any that have not yet been applied,
 * and records each in the `schema_migrations` table.
 *
 * Rules:
 *  - Migration files must be named  NNNN_description.sql  (zero-padded number prefix)
 *  - They are run in ascending numeric order
 *  - Each migration runs inside its own transaction; on failure it rolls back
 *    and the server start is aborted so broken migrations can't be skipped
 *  - Already-applied migrations are never re-run (idempotent tracking)
 *  - Adding a new migration = just drop a new .sql file in /migrations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// ─── Colours for console output ──────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};

const log = {
  info:    (msg) => console.log(`${C.cyan}[migrate]${C.reset} ${msg}`),
  success: (msg) => console.log(`${C.green}[migrate]${C.reset} ${C.green}✓${C.reset} ${msg}`),
  skip:    (msg) => console.log(`${C.grey}[migrate]${C.reset} ${C.grey}↩ skipped${C.reset} ${msg}`),
  warn:    (msg) => console.warn(`${C.yellow}[migrate]${C.reset} ${C.yellow}⚠${C.reset}  ${msg}`),
  error:   (msg) => console.error(`${C.red}[migrate]${C.reset} ${C.red}✗${C.reset} ${msg}`),
};

// ─── Bootstrap the tracking table ────────────────────────────────────────────
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id           SERIAL PRIMARY KEY,
      filename     VARCHAR(300) NOT NULL UNIQUE,
      applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      checksum     VARCHAR(64),
      duration_ms  INTEGER
    );
    COMMENT ON TABLE schema_migrations IS
      'Tracks which SQL migration files have been applied to this database.';
  `);
}

// ─── Read already-applied filenames from DB ───────────────────────────────────
async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC');
  return new Set(result.rows.map((r) => r.filename));
}

// ─── Discover migration files on disk ────────────────────────────────────────
function discoverMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log.warn(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
    .sort(); // lexicographic = numeric order for zero-padded names
}

// ─── Simple checksum (not cryptographic, just a quick fingerprint) ────────────
function checksum(content) {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ─── Apply a single migration file ───────────────────────────────────────────
async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  const cs = checksum(sql);
  const start = Date.now();

  log.info(`Applying ${C.bold}${filename}${C.reset} …`);

  try {
    await client.query('BEGIN');

    // Strip out bare COMMIT/BEGIN statements that might be in legacy SQL files
    // so we don't accidentally break our wrapping transaction
    const sanitizedSql = sql
      .replace(/^\s*COMMIT\s*;/gim, '-- [commit removed by migrate.js]')
      .replace(/^\s*BEGIN\s*;/gim,  '-- [begin removed by migrate.js]');

    await client.query(sanitizedSql);

    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, cs, Date.now() - start],
    );

    await client.query('COMMIT');
    log.success(`${filename} applied in ${Date.now() - start}ms`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // 1. Ensure tracking table exists
    await ensureMigrationsTable(client);

    // 2. Get already-applied migrations
    const applied = await getAppliedMigrations(client);

    // 3. Discover migration files
    const files = discoverMigrationFiles();

    if (files.length === 0) {
      log.warn('No migration files found in /migrations directory.');
      return;
    }

    // 4. Find pending migrations
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      log.info(`All ${files.length} migrations already applied. Database is up to date.`);
      return;
    }

    log.info(`Found ${pending.length} pending migration(s) out of ${files.length} total.`);

    // 5. Apply each pending migration sequentially
    for (const filename of pending) {
      await applyMigration(client, filename);
    }

    log.success(`Migration complete. ${pending.length} migration(s) applied.`);
  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    log.error('Server startup aborted. Fix the migration and restart.');
    throw err; // Propagate to server.js → process exits
  } finally {
    client.release();
  }
}

// ─── Allow running directly: node src/migrate.js ─────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

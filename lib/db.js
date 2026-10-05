import { schema } from './schema.js';

// En ligne (Vercel) : Postgres chez Neon, via DATABASE_URL.
// Sur ton ordinateur, sans DATABASE_URL : PGlite, un Postgres complet stocké dans .data/pglite
// (ou dans le dossier PGLITE_DIR ; « memory:// » pour une base en mémoire, utilisée par les tests).
const g = globalThis;

async function connect() {
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    try {
      await sql.query('CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
      const rows = await sql.query('SELECT COALESCE(MAX(version), 0)::int AS max_v FROM _schema_migrations');
      const currentVersion = Number(rows[0]?.max_v) || 0;
      if (currentVersion < schema.length) {
        for (let i = currentVersion; i < schema.length; i++) {
          try {
            await sql.query(schema[i]);
          } catch (err) {
            // Ignorer les erreurs d'objets ou colonnes déjà existants
          }
          try {
            await sql.query(`INSERT INTO _schema_migrations (version) VALUES (${i + 1}) ON CONFLICT (version) DO NOTHING`);
          } catch {
            // Ignorer
          }
        }
      }
    } catch {
      for (const statement of schema) {
        try {
          await sql.query(statement);
        } catch (err) {
          // Ignorer les erreurs d'objets ou colonnes déjà existants
        }
      }
    }
    return { query: (text, params = []) => sql.query(text, params) };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('fs');
  // « memory:// » : base en mémoire, effacée à la fin (tests automatiques)
  const dir = process.env.PGLITE_DIR || './.data/pglite';
  if (!dir.startsWith('memory://')) mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  for (const statement of schema) await pg.exec(statement);
  return { query: async (text, params = []) => (await pg.query(text, params)).rows };
}

function client() {
  if (!g.__db) {
    // En cas d'échec, on réessaiera à la prochaine requête
    g.__db = connect().catch((err) => { g.__db = null; throw err; });
  }
  return g.__db;
}

// Toutes les lignes
export async function q(text, params) {
  return (await client()).query(text, params);
}

// La première ligne, ou null
export async function one(text, params) {
  return (await q(text, params))[0] ?? null;
}

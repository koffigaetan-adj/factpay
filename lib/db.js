import { schema } from './schema.js';

// En ligne (Vercel) : Postgres chez Neon, via DATABASE_URL.
// Sur ton ordinateur, sans DATABASE_URL : PGlite, un Postgres complet stocké dans .data/pglite.
const g = globalThis;

async function connect() {
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    return { query: (text, params = []) => sql.query(text, params) };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('node:fs');
  mkdirSync('./.data', { recursive: true });
  const pg = new PGlite('./.data/pglite');
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

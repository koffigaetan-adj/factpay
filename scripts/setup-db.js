// Crée les tables dans la base Neon. Lancé automatiquement à chaque déploiement Vercel.
import { neon } from '@neondatabase/serverless';
import { schema } from '../lib/schema.js';

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL absent : base locale PGlite, les tables se créent au démarrage.');
  process.exit(0);
}
const sql = neon(process.env.DATABASE_URL);
for (const statement of schema) await sql.query(statement);
console.log(`Base prête (${schema.length} instructions).`);

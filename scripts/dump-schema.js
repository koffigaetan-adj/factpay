// Génère schema.sql à partir de lib/schema.js : le SQL à exécuter sur la base en ligne.
//
// Le schéma vit dans le code, pas dans un fichier .sql : ce script évite que les deux divergent.
// Lancé avec : npm run db:sql
import { writeFile } from 'node:fs/promises';
import { schema } from '../lib/schema.js';

const header = `-- Schéma FactPay — à exécuter sur la base Postgres (Neon).
--
-- Généré par « npm run db:sql » depuis lib/schema.js. Ne pas modifier à la main.
--
-- Toutes les instructions sont idempotentes (IF NOT EXISTS) : ce fichier peut être rejoué
-- sans risque sur une base déjà à jour, et sur une base existante il ajoute ce qui manque
-- sans rien détruire. Les données existantes ne sont jamais supprimées.
--
-- Colonne ajoutée sans valeur par défaut : sans DEFAULT, PostgreSQL refuse l'ALTER TABLE si la
-- table contient déjà des lignes (une colonne NOT NULL doit être renseignée). Si vous obtenez
-- « column contains null values », exécutez d'abord le UPDATE indiqué dans le message, ou la
-- version « SET NOT NULL » de la ligne concernée.

`;

const body = schema.map((s) => `${s.trim()};`).join('\n\n');

const check = `
-- Vérification : liste les tables réellement présentes dans la base.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
`;

await writeFile(new URL('../schema.sql', import.meta.url), header + body + check, 'utf8');
console.log(`schema.sql généré : ${schema.length} instructions.`);

// --- Requête de diagnostic : elle liste ce qui manque réellement dans la base connectée. ---
const tables = new Set();
const columns = new Set();
for (const s of schema) {
  const t = s.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
  if (t) tables.add(t[1]);
  const c = s.match(/ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/i);
  if (c) columns.add(`${c[1]}|${c[2]}`);
}

const oneCol = (vals) => [...vals].map((v) => `    ('${v}')`).join(',\n');
const twoCols = (vals) => [...vals].map((v) => {
  const [t, c] = v.split('|');
  return `    ('${t}', '${c}')`;
}).join(',\n');

const diag = `-- Diagnostic FactPay — à exécuter AVANT schema.sql (lecture seule, ne modifie rien).
-- La première requête liste ce qui manque (table ou colonne) par rapport à ce que le code attend.
-- Résultat vide = la base est à jour, inutile d'exécuter schema.sql.

-- 1. Objets attendus par le code et absents de la base
WITH attendu(table_name) AS (VALUES
${oneCol(tables)}
),
attendu_colonne(table_name, column_name) AS (VALUES
${twoCols(columns)}
)
SELECT 'table' AS manque, a.table_name AS objet
FROM attendu a
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t
                  WHERE t.table_schema='public' AND t.table_name=a.table_name)
UNION ALL
SELECT 'colonne', c.table_name || '.' || c.column_name
FROM attendu_colonne c
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns col
                  WHERE col.table_schema='public'
                    AND col.table_name=c.table_name AND col.column_name=c.column_name)
ORDER BY 1, 2;

-- 2. Compteurs de contrôle
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tables_presentes,
  (SELECT count(*) FROM employees)   AS salaries,
  (SELECT count(*) FROM companies)   AS entreprises,
  (SELECT count(*) FROM invoices)    AS factures,
  (SELECT count(*) FROM payslips)    AS bulletins;
`;

await writeFile(new URL('../schema-check.sql', import.meta.url), diag, 'utf8');
console.log(`schema-check.sql généré : ${tables.size} tables, ${columns.size} colonnes attendues.`);

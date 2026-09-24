// Documents : ajout, formats refusés, rattachement à un client, échéance, suppression du fichier.
// Base en mémoire ; les fichiers de test vont dans .data/uploads puis sont supprimés.
process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

let one, docs, c, clientId, otherClient;
before(async () => {
  ({ one } = await import('../lib/db.js'));
  docs = await import('../lib/documents.js');
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('doc@x.tg', 'D', 'x') RETURNING id");
  c = await one("INSERT INTO companies (owner_id, name) VALUES ($1, 'Studio') RETURNING *", [u.id]);
  clientId = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Client', 'c@x.com') RETURNING id", [c.id])).id;
  const u2 = await one("INSERT INTO users (email, name, password_hash) VALUES ('autre@x.tg', 'A', 'x') RETURNING id");
  const c2 = await one("INSERT INTO companies (owner_id, name) VALUES ($1, 'Autre') RETURNING *", [u2.id]);
  otherClient = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Pas à moi', 'p@x.com') RETURNING id", [c2.id])).id;
});

// Commence par le vrai en-tête PDF (%PDF) : le contrôle du contenu (lib/filetype.js) n'écarte que
// les fichiers dont le contenu ne correspond pas à leur type annoncé.
const pdf = (name = 'contrat.pdf', size = 1000) => new File([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 1)])], name, { type: 'application/pdf' });

test('ajout, liste par client, suppression du fichier', async () => {
  const r = await docs.addDocument(c.id, { file: pdf(), category: 'contrat', clientId, expiresOn: '2026-01-01' });
  assert.ok(r.id);
  const [d] = await docs.listDocuments(c.id, { clientId });
  assert.equal(d.title, 'contrat');
  assert.equal(d.client_name, 'Client');
  assert.equal(docs.expiryState(d), 'expired');
  const file = path.join(process.cwd(), '.data', 'uploads', d.file_key.slice(6));
  assert.ok(existsSync(file));
  assert.ok(await docs.removeDocument(c.id, d.id));
  assert.ok(!existsSync(file), 'le fichier est supprimé avec le document');
});

test('formats, taille et client d\'une autre entreprise refusés', async () => {
  const exe = new File([Buffer.alloc(10)], 'virus.exe', { type: 'application/x-msdownload' });
  assert.match((await docs.addDocument(c.id, { file: exe })).error, /Format non accepté/);
  assert.match((await docs.addDocument(c.id, { file: pdf('gros.pdf', 5 * 1024 * 1024) })).error, /4 Mo/);
  assert.equal((await docs.addDocument(c.id, { file: pdf(), clientId: otherClient })).error, 'Client introuvable.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { q, one } from '../lib/db.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('session : expire après 1 heure sans activité', async () => {
  const email = `inactivity-${Date.now()}-${Math.random().toString(36).slice(2)}@test.tg`;
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Inact', 'x') RETURNING id", [email]);
  const token = 'test-token-inactivity-' + Date.now();
  const hashed = sha256(token);

  // Session active avec échéance d'1 heure
  await q(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashed, u.id]);
  const active = await one(`SELECT id FROM sessions WHERE id = $1 AND expires_at > now()`, [hashed]);
  assert.ok(active, 'La session active dans l’heure est bien valide');

  // Si 1 heure sans activité s'écoule (expiration dépassée)
  await q(`UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = $1`, [hashed]);
  const expired = await one(`SELECT id FROM sessions WHERE id = $1 AND expires_at > now()`, [hashed]);
  assert.equal(expired, null, 'La session inactive depuis plus d’une heure est rejetée');
});

test('session : prolonge l’expiration de 1 heure lors d’une activité', async () => {
  const email = `prolong-${Date.now()}-${Math.random().toString(36).slice(2)}@test.tg`;
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Prolong', 'x') RETURNING id", [email]);
  const token = 'test-token-prolong-' + Date.now();
  const hashed = sha256(token);

  // Session avec seulement 10 minutes restantes
  await q(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`, [hashed, u.id]);
  const before = await one(`SELECT expires_at FROM sessions WHERE id = $1`, [hashed]);

  // Touch / prolongement
  await q(`UPDATE sessions SET expires_at = now() + interval '1 hour' WHERE id = $1 AND expires_at > now()`, [hashed]);
  const after = await one(`SELECT expires_at FROM sessions WHERE id = $1`, [hashed]);

  assert.ok(new Date(after.expires_at) > new Date(before.expires_at), 'L’expiration a bien été repoussée');
  const minutes = Math.round((new Date(after.expires_at) - Date.now()) / 60000);
  assert.ok(minutes >= 58 && minutes <= 61, `L’échéance est bien recalée à ~60 minutes (actuel: ${minutes} min)`);
});

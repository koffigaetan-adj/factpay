// Double authentification : codes d'application (TOTP), chiffrement, vérification à la connexion, codes de secours.
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { base32Encode, codeAt, currentStep, verifyCode, newSecret } from '../lib/totp.js';

let q, one, twofa;
before(async () => {
  ({ q, one } = await import('../lib/db.js'));
  twofa = await import('../lib/twofa.js');
});

test('codes TOTP conformes à la norme (RFC 6238)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(codeAt(secret, Math.floor(59 / 30)), '287082');
  assert.equal(codeAt(secret, Math.floor(1111111109 / 30)), '081804');
  const s = newSecret();
  assert.notEqual(verifyCode(s, codeAt(s, currentStep())), null);
  assert.notEqual(verifyCode(s, codeAt(s, currentStep() - 1)), null, '30 s de décalage toléré');
  assert.equal(verifyCode(s, codeAt(s, currentStep() - 3)), null, 'code trop ancien refusé');
});

test('le secret est chiffré en base et se relit', () => {
  const s = newSecret();
  const enc = twofa.encrypt(s);
  assert.ok(!enc.includes(s));
  assert.equal(twofa.decrypt(enc), s);
});

test('connexion par e-mail : bon code, mauvais code, 5 essais au plus', async () => {
  const u = await one("INSERT INTO users (email, name, password_hash, twofa_method) VALUES ('mail@x.tg', 'M', 'x', 'email') RETURNING *");
  const { token, emailCode } = await twofa.createChallenge(u);
  assert.match(emailCode, /^\d{6}$/);
  const wrong = emailCode === '000000' ? '111111' : '000000';
  assert.equal((await twofa.verifyChallenge(token, wrong)).ok, false);
  const r = await twofa.verifyChallenge(token, emailCode);
  assert.ok(r.ok);
  assert.equal(r.userId, u.id);
  assert.equal((await twofa.verifyChallenge(token, emailCode)).expired, true, 'une vérification ne sert qu\'une fois');

  const again = await twofa.createChallenge(u);
  for (let i = 0; i < 5; i += 1) await twofa.verifyChallenge(again.token, wrong);
  assert.equal((await twofa.verifyChallenge(again.token, again.emailCode)).expired, true, 'bloquée après 5 erreurs');
});

test('connexion par application : code refusé s\'il est rejoué', async () => {
  const secret = newSecret();
  const u = await one("INSERT INTO users (email, name, password_hash, twofa_method, totp_secret) VALUES ('app@x.tg', 'A', 'x', 'totp', $1) RETURNING *", [twofa.encrypt(secret)]);
  const code = codeAt(secret, currentStep());
  const first = await twofa.createChallenge(u);
  assert.equal(first.emailCode, null);
  assert.ok((await twofa.verifyChallenge(first.token, code)).ok);
  const second = await twofa.createChallenge(u);
  assert.equal((await twofa.verifyChallenge(second.token, code)).ok, false, 'le même code ne sert pas deux fois');
});

test('codes de secours : un seul usage chacun', async () => {
  const { codes, hashes } = twofa.newBackupCodes();
  assert.equal(codes.length, 8);
  const u = await one("INSERT INTO users (email, name, password_hash, twofa_method, backup_codes) VALUES ('secours@x.tg', 'S', 'x', 'email', $1) RETURNING *", [JSON.stringify(hashes)]);
  const a = await twofa.createChallenge(u);
  const r = await twofa.verifyChallenge(a.token, codes[0].toLowerCase());
  assert.ok(r.ok && r.usedBackup);
  const b = await twofa.createChallenge(u);
  assert.equal((await twofa.verifyChallenge(b.token, codes[0])).ok, false);
  const left = JSON.parse((await one('SELECT backup_codes FROM users WHERE id = $1', [u.id])).backup_codes);
  assert.equal(left.length, 7);
});

// Portail salarié : expiration du lien, révocation, régénération, isolation des droits,
// journal des consultations, et attestation de travail.
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let one, q, empLib, portalLib, leaveLib, certLib, empPageSrc;

before(async () => {
  ({ one, q } = await import('../lib/db.js'));
  empLib = await import('../lib/employees.js');
  portalLib = await import('../lib/portal.js');
  leaveLib = await import('../lib/leaves.js');
  certLib = await import('../lib/certificates.js');
});

async function makeCompany(ownerEmail, name = 'Tech Solutions Lomé') {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Admin', 'x') RETURNING id", [ownerEmail]);
  return one("INSERT INTO companies (owner_id, name, currency, email, address) VALUES ($1, $2, 'XOF', $3, 'Rue des Rails, Lomé') RETURNING *",
    [u.id, name, ownerEmail]);
}

test("Portail : le lien d'accès expire et cesse d'ouvrir le portail", async () => {
  const company = await makeCompany('portail1@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Koffi', last_name: 'Mensah', base_salary: 250000 });

  const token = await portalLib.getOrCreatePortalToken(emp.id);
  assert.ok(token, "Un lien est créé à la demande");
  assert.ok(await portalLib.getEmployeeByPortalToken(token), "Le lien ouvre le portail");

  const row = await one('SELECT portal_token_expires_at FROM employees WHERE id = $1', [emp.id]);
  assert.ok(row.portal_token_expires_at, "Une date d'expiration est posée");
  const days = Math.round((new Date(row.portal_token_expires_at) - Date.now()) / 86400000);
  assert.equal(days, portalLib.TOKEN_DAYS, `Le lien est valable ${portalLib.TOKEN_DAYS} jours`);

  // Un lien expiré est traité comme inexistant, pas comme un accès ouvert
  await q("UPDATE employees SET portal_token_expires_at = now() - interval '1 day' WHERE id = $1", [emp.id]);
  assert.equal(await portalLib.getEmployeeByPortalToken(token), null, "Un lien expiré n'ouvre plus le portail");
  assert.equal(await portalLib.portalEmployee(token), null, "Le garde-fou du formulaire refuse aussi le lien expiré");
  assert.ok(await portalLib.portalIsExpired(token), "L'expiration est signalée pour proposer un renouvellement");

  // Une fois l'échéance repoussée, le même lien rouvre le portail
  await q("UPDATE employees SET portal_token_expires_at = $1 WHERE id = $2", [portalLib.portalExpiryOf(), emp.id]);
  assert.ok(await portalLib.getEmployeeByPortalToken(token), "Le portail rouvre avec un lien valide");
});

test("Portail : chaque visite repousse l'échéance, le lien ne meurt que s'il est abandonné", async () => {
  const company = await makeCompany('portail-glisse@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Yao', last_name: 'Kpodzi', base_salary: 200000 });
  const token = await portalLib.getOrCreatePortalToken(emp.id);

  // On rapproche l'échéance de maintenant, comme si le lien avait été renvoyé il y a 89 jours.
  await q("UPDATE employees SET portal_token_expires_at = now() + interval '1 hour' WHERE id = $1", [emp.id]);
  const before = await one('SELECT portal_token_expires_at FROM employees WHERE id = $1', [emp.id]);

  const visited = await portalLib.getEmployeeByPortalToken(token);
  await portalLib.touchPortalAccess(visited);

  const after = await one('SELECT portal_token_expires_at, portal_last_seen_at FROM employees WHERE id = $1', [emp.id]);
  assert.ok(
    new Date(after.portal_token_expires_at) > new Date(before.portal_token_expires_at),
    "La visite repousse l'échéance du lien",
  );
  const days = Math.round((new Date(after.portal_token_expires_at) - Date.now()) / 86400000);
  assert.equal(days, portalLib.TOKEN_DAYS, `Après la visite, le lien est à nouveau valable ${portalLib.TOKEN_DAYS} jours`);
  assert.ok(after.portal_last_seen_at, "La visite est journalisée");
  assert.ok(await portalLib.getEmployeeByPortalToken(token), "Le même lien reste valide, sans régénération");
});

test("Portail : le compteur « sans accès » ne compte que les salariés réellement joignables", async () => {
  const company = await makeCompany('portail-compteur@company.tg');
  const actif = await empLib.saveEmployee(company, { first_name: 'Ama', last_name: 'Sosah', base_salary: 180000 });
  const enConge = await empLib.saveEmployee(company, { first_name: 'Yao', last_name: 'Doevi', base_salary: 180000, status: 'conge' });
  const archive = await empLib.saveEmployee(company, { first_name: 'Ko', last_name: 'Nyansi', base_salary: 180000, status: 'archive' });
  assert.ok(archive.id, "Le salarié archivé est bien créé");

  let counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.sansPortail, 2, "Un salarié en congé compte encore : il a besoin de ses bulletins");

  await portalLib.getOrCreatePortalToken(actif.id);
  counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.sansPortail, 1, "Un lien actif sort le salarié du compteur");

  // Un lien échu ne donne plus accès : le salarié doit être recontacté, donc il recompte.
  await q("UPDATE employees SET portal_token_expires_at = now() - interval '1 day' WHERE id = $1", [actif.id]);
  counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.sansPortail, 2, "Un lien expiré recompte comme un accès à réactiver");

  // Un archivé n'est pas « à réactiver » : il ne doit pas gonfler le compteur.
  counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.sansPortail, 2, "Un archivé ne compte pas comme accès manquant");
});

test("Portail : régénérer coupe réellement l'ancien lien, révoquer coupe l'accès", async () => {
  const company = await makeCompany('portail2@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Afi', last_name: 'Agbessi', base_salary: 150000 });

  const first = await portalLib.getOrCreatePortalToken(emp.id);
  // Sans regen, la fonction renvoie le même jeton (création idempotente)
  assert.equal(await portalLib.getOrCreatePortalToken(emp.id), first, "Créer deux fois ne change rien");

  const second = await portalLib.getOrCreatePortalToken(emp.id, { force: true });
  assert.notEqual(second, first, "Régénérer produit un nouveau jeton");
  assert.equal(await portalLib.getEmployeeByPortalToken(first), null, "L'ancien lien ne fonctionne plus");
  assert.ok(await portalLib.getEmployeeByPortalToken(second), "Le nouveau lien fonctionne");

  await portalLib.revokePortalToken(emp.id);
  assert.equal(await portalLib.getEmployeeByPortalToken(second), null, "Révoquer coupe l'accès");
  const row = await one('SELECT portal_token FROM employees WHERE id = $1', [emp.id]);
  assert.equal(row.portal_token, null, "Plus aucun jeton en base après révocation");
});

test("Portail : un jeton ne donne accès qu'au dossier de son propre salarié", async () => {
  const company = await makeCompany('portail3@company.tg');
  const alice = await empLib.saveEmployee(company, { first_name: 'Alice', last_name: 'Ahou', base_salary: 100000 });
  const bob = await empLib.saveEmployee(company, { first_name: 'Bob', last_name: 'Bessah', base_salary: 120000 });

  const aliceToken = await portalLib.getOrCreatePortalToken(alice.id);
  const asAlice = await portalLib.portalEmployee(aliceToken);
  assert.equal(asAlice.id, alice.id, "Le jeton ouvre le bon salarié");
  assert.equal(asAlice.company_id, company.id);

  // Les données du portail ne contiennent que les pièces du salarié concerné
  const data = await portalLib.getEmployeePortalData(asAlice);
  assert.equal(data.employee.id, alice.id);
  for (const l of data.leaves) assert.equal(l.employee_id, alice.id, "Aucune demande d'un autre salarié");
  assert.notEqual(bob.id, alice.id);

  // Le composant portail est client : ni le jeton, ni le salaire, ni les coordonnées de paiement
  // ne doivent partir vers le navigateur du salarié.
  assert.equal(data.employee.portal_token, undefined, "Le jeton n'est pas envoyé au navigateur");
  assert.equal(data.employee.portal_token_expires_at, undefined, "L'échéance du jeton non plus");
  assert.equal(data.employee.base_salary, undefined, "Le salaire de base n'est pas exposé");
  assert.equal(data.employee.payment_details, undefined, "Les coordonnées de paiement ne sont pas exposées");
  assert.equal(data.employee.first_name, 'Alice', "Les données affichées restent présentes");
  assert.equal(data.employee.company_id, company.id);

  // Un jeton fabriqué n'ouvre rien
  assert.equal(await portalLib.portalEmployee('emp_fabrique'), null, "Un jeton inexistant est refusé");
  assert.equal(await portalLib.portalEmployee(''), null, "Un jeton vide est refusé");
  assert.equal(await portalLib.portalEmployee(null), null, "Un jeton absent est refusé");
});

test("Portail : les visites sont journalisées pour le suivi RH", async () => {
  const company = await makeCompany('portail4@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Komi', last_name: 'Dzidzi', base_salary: 90000 });
  const token = await portalLib.getOrCreatePortalToken(emp.id);
  const employee = await portalLib.getEmployeeByPortalToken(token);

  assert.equal(employee.portal_last_seen_at, null, "Aucune visite au départ");

  await portalLib.touchPortalAccess(employee);
  await portalLib.touchPortalAccess(employee);

  const visited = await one('SELECT portal_last_seen_at FROM employees WHERE id = $1', [emp.id]);
  assert.ok(visited.portal_last_seen_at, "La dernière visite est mémorisée");

  const log = await portalLib.recentPortalAccess(emp.id);
  assert.equal(log.length, 2, "Les deux ouvertures sont journalisées");
  assert.ok(new Date(log[0].seen_at) >= new Date(log[1].seen_at), "Le journal est trié du plus récent au plus ancien");
});

test("Portail : la page est déclarée non indexable", async () => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../app/portail/[token]/page.js', import.meta.url), 'utf8');
  assert.match(src, /robots:\s*\{\s*index:\s*false/, "Le portail salarié ne doit jamais être indexé");
  assert.match(src, /follow:\s*false/, "Le portail ne doit pas être suivi par les robots");
  assert.match(src, /force-dynamic/, "Le portail n'est pas mis en cache");
});

test("Attestation de travail : elle est rédigée au nom de l'entreprise, pas du salarié", async () => {
  const company = await makeCompany('portail5@company.tg', 'SARL Lomé Digital');
  const emp = await empLib.saveEmployee(company, {
    first_name: 'Kossi', last_name: 'Ago', job_title: 'Comptable', hire_date: '2024-03-01',
    cnss_number: 'CNSS-TG-12345', contract_type: 'CDI', base_salary: 300000,
  });

  const cert = certLib.getWorkCertificateText(company, emp);
  assert.match(cert.statement, /Nous soussignés, SARL Lomé Digital/, "L'employeur nommé est l'entreprise");
  assert.match(cert.statement, /Kossi Ago/, "Le salarié est nommé");
  assert.doesNotMatch(cert.statement, /Nous soussignés, Kossi/, "Le salarié ne peut pas se signer lui-même");
  assert.equal(cert.companyName, 'SARL Lomé Digital');
  assert.equal(cert.employeeCnss, 'CNSS-TG-12345');

  // Signature de l'appel fautive : passer le salarié en entreprise produisait un document absurde
  const wrong = certLib.getWorkCertificateText(emp, emp);
  assert.notEqual(wrong.statement, cert.statement, "La signature (company, employee) distingue bien les deux");
});

test("RH : un salarié ne peut pas écrire dans une autre entreprise (company_id ignoré)", async () => {
  // Les trois actions de création de demande lisaient `company_id` dans le formulaire au lieu de
  // la session : n'importe quel compte pouvait injecter les données d'une autre entreprise. Ici on
  // vérifie que la couche métier refuse bien un salarié qui n'appartient pas à la société.
  const victim = await makeCompany('victim@company.tg', 'Victime SARL');
  const attacker = await makeCompany('attacker@company.tg', 'Attaquant SARL');
  const victimEmp = await empLib.saveEmployee(victim, { first_name: 'Victime', last_name: 'Salariee', base_salary: 200000 });

  const req = await leaveLib.createLeaveRequest(attacker.id, {
    employee_id: victimEmp.id, type: 'conge_paye', start_date: '2026-10-01', end_date: '2026-10-02',
    days_count: 2, reason: 'tentative',
  }).then(() => null, (err) => err);
  assert.ok(req, "La création est refusée");
  assert.match(req.message, /Salarié introuvable/, "Un salarié d'une autre entreprise est inconnu de l'attaquant");

  const all = await leaveLib.listLeaveRequests(attacker.id);
  assert.equal(all.length, 0, "Aucune demande n'a été créée du côté de l'attaquant");

  const victimAll = await leaveLib.listLeaveRequests(victim.id);
  assert.equal(victimAll.length, 0, "Aucune demande n'a été créée chez la victime");
});

test("RH : le justificatif et le reçu sont enregistrés et contrôlés", async () => {
  const company = await makeCompany('portail6@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Sena', last_name: 'Akakpo', base_salary: 180000 });

  // Vrai en-tête PDF : le contrôle du contenu (lib/filetype.js) laisse passer un fichier cohérent
  const cert = new File([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(600, 1)])], 'certificat.pdf', { type: 'application/pdf' });

  const req = await leaveLib.createLeaveRequest(company.id, {
    employee_id: emp.id, type: 'maladie', start_date: '2026-11-02', end_date: '2026-11-04',
    days_count: 3, reason: 'Arrêt maladie',
  }, cert);

  assert.ok(req.id, "La demande est créée");
  assert.equal(req.document_name, 'certificat.pdf', "Le nom du justificatif est conservé");
  assert.equal(req.document_mime, 'application/pdf');
  assert.ok(req.document_url, "Le fichier est rangé dans le stockage");

  // Un fichier dont le contenu ne correspond pas au format annoncé est refusé, et rien n'est créé
  const disguised = new File([Buffer.from('#!/bin/sh\necho salut\n')], 'photo.png', { type: 'image/png' });
  const refused = await leaveLib.createLeaveRequest(company.id, {
    employee_id: emp.id, type: 'maladie', start_date: '2026-11-02', end_date: '2026-11-02',
    days_count: 1, reason: 'faux fichier',
  }, disguised);
  assert.ok(refused.error, "Un fichier renommé est refusé");
  assert.equal((await leaveLib.listLeaveRequests(company.id)).length, 1, "La demande refusée n'a pas été créée à moitié");

  // Un format non admis est refusé avant tout enregistrement
  const exe = new File([Buffer.alloc(40)], 'virus.exe', { type: 'application/x-msdownload' });
  const badType = await leaveLib.createLeaveRequest(company.id, {
    employee_id: emp.id, type: 'maladie', start_date: '2026-11-02', end_date: '2026-11-02', days_count: 1,
  }, exe);
  assert.match(badType.error, /Format non accepté/);
});

test("RH : les compteurs de la barre latérale reflètent les demandes en attente", async () => {
  const company = await makeCompany('nav@company.tg');
  const emp = await empLib.saveEmployee(company, { first_name: 'Yao', last_name: 'Mensah', base_salary: 220000 });

  const empty = await empLib.getRhNavCounts(company.id);
  assert.equal(empty.effectif, 1, "Un salarié actif");
  assert.equal(empty.conges, 0, "Aucune demande de congé en attente");
  assert.equal(empty.notes, 0);
  assert.equal(empty.acomptes, 0);

  const req = await leaveLib.createLeaveRequest(company.id, {
    employee_id: emp.id, type: 'conge_paye', start_date: '2026-12-01', end_date: '2026-12-05',
    days_count: 5, reason: 'Vacances',
  });

  const after = await empLib.getRhNavCounts(company.id);
  assert.equal(after.conges, 1, "La demande en attente est comptée");
  assert.equal(after.effectif, 1);

  await leaveLib.reviewLeaveRequest(company.id, req.id, { status: 'approuve' });
  const done = await empLib.getRhNavCounts(company.id);
  assert.equal(done.conges, 0, "Une demande traitée sort du compteur");
});
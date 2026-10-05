// État d'accès au portail d'un salarié, tel que l'affichent la liste, la fiche et le filtre.
// Fonction pure, sans base : elle décide de ce que l'écran montre, elle doit donc être testée
// seule. Lancer avec : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { portalAccessState, portalLastSeenLabel, PORTAL_ACTIVE, PORTAL_PENDING, PORTAL_EXPIRED, PORTAL_NONE } from '../lib/portal-state.js';

const NOW = new Date('2026-03-10T12:00:00Z');
const inDays = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

test("Accès portail : un lien valide est actif s'il a été ouvert, ou en attente sinon ; un lien échu est expiré", () => {
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: inDays(30), portal_last_seen_at: daysAgo(1) }, NOW), PORTAL_ACTIVE);
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: inDays(30), portal_last_seen_at: null }, NOW), PORTAL_PENDING);
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: inDays(30) }, NOW), PORTAL_PENDING);
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: inDays(-1), portal_last_seen_at: daysAgo(2) }, NOW), PORTAL_EXPIRED);
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: inDays(0) }, NOW), PORTAL_EXPIRED,
    "L'échéance du jour même est déjà passée : le portail ne s'ouvre plus dessus");
  // Une échéance absente ne doit jamais valoir autorisation : le jeton seul ne suffit pas.
  assert.equal(portalAccessState({ portal_token: 'a', portal_token_expires_at: null }, NOW), PORTAL_EXPIRED);
});

test("Accès portail : sans jeton, l'état est « aucun » quoi qu'en dise l'échéance", () => {
  assert.equal(portalAccessState({ portal_token: null }, NOW), PORTAL_NONE);
  assert.equal(portalAccessState({}, NOW), PORTAL_NONE);
  assert.equal(portalAccessState(null, NOW), PORTAL_NONE, "Une ligne absente n'est pas un dossier sans accès");
  // Une ligne corrompue ne doit pas être comptée comme un accès ouvert.
  assert.equal(portalAccessState({ portal_token: '', portal_token_expires_at: inDays(10) }, NOW), PORTAL_NONE);
});

test("Accès portail : la dernière visite se lit d'un coup d'œil, y compris pour un dossier neuf", () => {
  assert.equal(portalLastSeenLabel({}), 'jamais ouvert');
  assert.equal(portalLastSeenLabel(null), 'jamais ouvert');
  assert.equal(portalLastSeenLabel({ portal_last_seen_at: daysAgo(0) }, NOW), 'ouvert aujourd\'hui');
  assert.equal(portalLastSeenLabel({ portal_last_seen_at: daysAgo(1) }, NOW), 'ouvert hier');
  assert.equal(portalLastSeenLabel({ portal_last_seen_at: daysAgo(3) }, NOW), 'ouvert il y a 3 jours');
  assert.equal(portalLastSeenLabel({ portal_last_seen_at: daysAgo(65) }, NOW), 'ouvert il y a 2 mois');
});
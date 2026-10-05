// Barre latérale : la page courante est-elle bien marquée, les sections se replient-elles comme
// prévu, et les compteurs n'apparaissent-ils que là où ils signalent une décision en attente.
// Fonction pure : elle décide de ce que l'écran montre, elle doit donc être testée seule.
// Lancer avec : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDEBAR_SECTIONS, WORKSPACES,
  isCurrentPath, isSectionCurrent, isWorkspaceCurrent, findSectionOf, findWorkspaceOf,
  actionsInSection, actionsInWorkspace,
} from '../lib/nav.js';

const section = (id) => SIDEBAR_SECTIONS.find((s) => s.id === id);

test("Barre latérale : « /factures » ne s'allume pas sur « /factures-recues »", () => {
  // La barre oblique ferme le segment : sans cela, toutes les pages de facturation allumaient
  // l'entrée « Mes factures » en même temps.
  assert.equal(isCurrentPath('/factures', '/factures'), true);
  assert.equal(isCurrentPath('/factures/12', '/factures'), true);
  assert.equal(isCurrentPath('/factures-recues', '/factures'), false);
  assert.equal(isCurrentPath('/factures-recues/12', '/factures'), false);
  assert.equal(isCurrentPath('/factures-recues', '/factures-recues'), true);

  assert.equal(isCurrentPath('/devis-recus', '/devis'), false, "Même piège sur les devis");
  assert.equal(isCurrentPath('/devis-recus', '/devis-recus'), true);

  // Le tableau de bord n'a pas de sous-page : un préfixe y serait faux.
  assert.equal(isCurrentPath('/tableau-de-bord', '/tableau-de-bord'), true);
  assert.equal(isCurrentPath('/tableau-de-bord/x', '/tableau-de-bord'), false);
});

test("Barre latérale : une page introuvable ne marque aucune entrée", () => {
  assert.equal(isCurrentPath('/inconnu', '/factures'), false);
  assert.equal(isCurrentPath('/devis', '/factures'), false);
});

test("Sections : chaque page tombe dans une section, et une seule", () => {
  assert.equal(findSectionOf('/employes')?.id, 'equipe');
  assert.equal(findSectionOf('/employes/3')?.id, 'equipe');
  assert.equal(findSectionOf('/acomptes')?.id, 'remunerer');
  assert.equal(findSectionOf('/organigramme')?.id, 'equipe');
  assert.equal(findSectionOf('/rapports')?.id, 'suivi');
  assert.equal(findSectionOf('/documents')?.id, 'suivi');
  assert.equal(findSectionOf('/factures')?.id, 'facturation');
  assert.equal(findSectionOf('/factures-recues')?.id, 'facturation');
  assert.equal(findSectionOf('/inconnu'), null);

  // Aucune page ne peut être revendiquée par deux sections, sinon deux colonnes s'affichent.
  for (const s of SIDEBAR_SECTIONS) {
    for (const item of s.items) {
      const owners = SIDEBAR_SECTIONS.filter((other) => other.items.some((i) => i.href === item.href));
      assert.equal(owners.length, 1, `${item.href} n'appartient qu'à une seule section`);
    }
  }
});

test("Le module paie & équipe n'est jamais masqué", () => {
  // Le bug d'origine : le groupe RH n'apparaissait qu'au-delà d'un certain effectif, donc un
  // exploitant sans salarié ne pouvait pas découvrir que le module existait.
  const rh = [...section('remunerer').items, ...section('equipe').items].map((i) => i.href);
  for (const href of ['/fiches-de-paie', '/acomptes', '/notes-de-frais', '/employes', '/conges', '/organigramme']) {
    assert.ok(rh.includes(href), `${href} est une page du cœur paie & équipe`);
  }
});

test("Sections : les compteurs d'une page ne survolent pas les volumes", () => {
  // Une section compte ses décisions, pas ses volumes : c'est ce que montre la pastille.
  const remuneration = section('remunerer');
  assert.equal(actionsInSection(remuneration, { bulletinsAPayer: 2, acomptes: 1 }), 3);
  assert.equal(actionsInSection(remuneration, { acomptes: 1 }), 1, "Un acompte attend une décision");

  const equipe = section('equipe');
  assert.equal(actionsInSection(equipe, { effectif: 12 }), 0, "Un effectif n'est pas une alerte");

  const facturation = section('facturation');
  assert.equal(actionsInSection(facturation, { facturesRecues: 3, mesFactures: 1 }), 1,
    "Une facture reçue se traite à son échéance, ce n'est pas une décision en attente");

  // Un compteur absent ne doit pas devenir NaN.
  assert.equal(actionsInSection(equipe, {}), 0);
  assert.equal(actionsInSection(equipe, undefined), 0);
});

test("« à traiter » ne compte que les décisions, jamais un volume", () => {
  // Régression : la pastille d'en-tête et le compteur du tableau de bord ne doivent pas gonfler
  // d'un effectif ou d'une facture reçue. Ces volumes-là se traitent à leur échéance.
  const equipe = section('equipe');
  assert.equal(actionsInSection(equipe, { effectif: 12 }), 0, "12 salariés, 0 décision");
  assert.equal(actionsInSection(equipe, { effectif: 12, conges: 3 }), 3, "Seules les 3 demandes comptent");

  const facturation = section('facturation');
  assert.equal(actionsInSection(facturation, { facturesRecues: 5, devisRecus: 2 }), 0,
    "Factures et devis reçus sont des volumes, pas des décisions");
  assert.equal(actionsInSection(facturation, { facturesRecues: 5, mesFactures: 1 }), 1);

  assert.equal(actionsInSection(equipe, {}), 0);
  assert.equal(actionsInSection(equipe, undefined), 0);
});

test("Espaces : la barre ne liste que les espaces, jamais le détail de leurs pages", () => {
  // Le détail est dans la colonne de gauche de chaque page. Le recopier dans la barre
  // l'allongeait sans rien apprendre et les deux copies divergeaient.
  const hrefs = WORKSPACES.map((w) => w.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "Aucun espace en double");

  const barHrefs = WORKSPACES.map((w) => w.href);
  for (const section of SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      if (hrefs.includes(item.href)) continue; // la page d'accueil d'un espace reste une entrée
      assert.ok(!barHrefs.includes(item.href), `${item.href} n'est pas une entrée de la barre`);
    }
  }

  // Chaque page de chaque section est rattachée à un espace, sinon la barre ne s'allume pas.
  for (const section of SIDEBAR_SECTIONS) {
    const owners = WORKSPACES.filter((w) => w.sectionIds.includes(section.id));
    assert.equal(owners.length, 1, `La section ${section.id} appartient à un seul espace`);
  }
});

test("Espaces : la page ouverte allume le bon espace", () => {
  assert.equal(findWorkspaceOf('/fiches-de-paie')?.id, 'rh');
  assert.equal(findWorkspaceOf('/conges')?.id, 'rh', "Congés est dans l'espace paie & équipe");
  assert.equal(findWorkspaceOf('/employes')?.id, 'rh');
  assert.equal(findWorkspaceOf('/factures-recues')?.id, 'facturation');
  assert.equal(findWorkspaceOf('/rapports')?.id, 'suivi');
  assert.equal(findWorkspaceOf('/documents')?.id, 'suivi');

  assert.equal(findWorkspaceOf('/tableau-de-bord'), null, "Le tableau de bord n'est dans aucun espace");
  assert.equal(findWorkspaceOf('/parametres'), null, "Les réglages ne sont pas un espace de travail");
  assert.equal(findWorkspaceOf('/inconnu'), null);

  // Le regroupement RH : les deux sections sont dans un seul espace, pas deux entrées de barre.
  const rh = WORKSPACES.find((w) => w.id === 'rh');
  assert.deepEqual(rh.sectionIds, ['remunerer', 'equipe']);
});

test("Espaces : « à traiter » ne compte que les décisions, jamais un volume", () => {
  const rh = WORKSPACES.find((w) => w.id === 'rh');
  assert.equal(actionsInWorkspace(rh, { bulletinsAPayer: 2, acomptes: 1, effectif: 12 }), 3,
    "Les 12 salariés ne sont pas des décisions à traiter");

  const facturation = WORKSPACES.find((w) => w.id === 'facturation');
  assert.equal(actionsInWorkspace(facturation, { facturesRecues: 5, devisRecus: 2 }), 0,
    "Factures et devis reçus sont des volumes");
  assert.equal(actionsInWorkspace(facturation, { facturesRecues: 5, mesFactures: 1, mesDevis: 2 }), 3);

  assert.equal(actionsInWorkspace(rh, {}), 0);
  assert.equal(actionsInWorkspace(rh, undefined), 0);
});
// Source de vérité de la navigation : la barre latérale, les espaces du tableau de bord et les
// onglets in-page lisent tous ce fichier. Une seule liste, donc aucun module ne peut s'appeler
// « Ressources Humaines » dans un coin et « Salariés » dans l'autre.
// La logique est hors du composant pour qu'elle reste vérifiable sans navigateur
// (tests/nav.test.js).

/**
 * Les espaces : ce sont les seules entrées de la barre latérale.
 *
 * Les pages d'un espace portent leur propre colonne de navigation (components/ModuleLayout.js),
 * alimentée par la même liste. Dupliquer ici le détail des pages doublerait la navigation dans
 * deux endroits, allongerait la barre, et les deux copies finiraient par diverger.
 *
 * sectionIds : sections dont les pages appartiennent à cet espace.
 * count : clé du compteur renvoyé par la mise en page (getSidebarCounts + getRhNavCounts).
 * tone  : 'action' = la personne doit décider, 'info' = volume entrant, 'volume' = information.
 */
export const WORKSPACES = [
  {
    id: 'rh',
    href: '/fiches-de-paie',
    label: 'Paie & équipe',
    detail: 'Bulletins, acomptes, salariés et congés',
    icon: 'briefcase',
    sectionIds: ['remunerer', 'equipe'],
  },
  {
    id: 'facturation',
    href: '/factures',
    label: 'Facturation',
    detail: 'Factures et devis, émis et reçus',
    icon: 'invoice',
    sectionIds: ['facturation'],
  },
  {
    id: 'suivi',
    href: '/rapports',
    label: 'Suivi',
    detail: 'Rapports, documents et clients',
    icon: 'report',
    sectionIds: ['suivi'],
  },
];

/**
 * Les réglages ne sont pas un espace de travail : on y passe pour changer un réglage, pas pour
 * travailler. Ils sortent donc de la barre, qui les place en pied de menu — à l'endroit où l'on
 * les cherchera quand on veut quitter le travail en cours.
 */
export const FOOTER_LINKS = [
  { href: '/documents', label: 'Documents', icon: 'documents' },
  { href: '/parametres', label: 'Paramètres', icon: 'settings' },
];

/**
 * Les sections, groupées par geste qu'on vient faire. Elles n'apparaissent plus dans la barre
 * latérale : elles servent à la colonne de navigation d'un espace, et à dire à quel espace
 * appartient une page.
 */
export const SIDEBAR_SECTIONS = [
  {
    id: 'remunerer',
    title: 'Rémunérer',
    icon: 'cash',
    items: [
      { href: '/fiches-de-paie', label: 'Fiches de paie', icon: 'payslip', count: 'bulletinsAPayer', tone: 'action', hint: 'bulletin à établir' },
      { href: '/acomptes', label: 'Acomptes sur salaire', icon: 'cash', count: 'acomptes', tone: 'action', hint: 'demande à examiner' },
      { href: '/notes-de-frais', label: 'Notes de frais', icon: 'file', count: 'notes', tone: 'action', hint: 'note à examiner' },
    ],
  },
  {
    id: 'equipe',
    title: 'Équipe',
    icon: 'people',
    items: [
      { href: '/employes', label: 'Salariés', icon: 'people', count: 'effectif', tone: 'volume', hint: 'salarié(s)' },
      { href: '/conges', label: 'Congés & absences', icon: 'calendar', count: 'conges', tone: 'action', hint: 'demande à examiner' },
      { href: '/organigramme', label: 'Organigramme', icon: 'briefcase' },
    ],
  },
  {
    id: 'facturation',
    title: 'Facturation',
    icon: 'invoice',
    items: [
      { href: '/factures', label: 'Mes factures', icon: 'invoice', count: 'mesFactures', tone: 'action', hint: 'paiement signalé à confirmer' },
      { href: '/factures-recues', label: 'Factures reçues', icon: 'file', count: 'facturesRecues', tone: 'info', hint: 'facture reçue à payer' },
      { href: '/devis', label: 'Mes devis', icon: 'quote', count: 'mesDevis', tone: 'action', hint: 'devis accepté à convertir' },
      { href: '/devis-recus', label: 'Devis reçus', icon: 'quote', count: 'devisRecus', tone: 'info', hint: 'devis reçu à traiter' },
    ],
  },
  {
    id: 'suivi',
    title: 'Suivi',
    icon: 'report',
    items: [
      { href: '/rapports', label: 'Rapports', icon: 'report' },
      { href: '/documents', label: 'Documents', icon: 'documents' },
      { href: '/clients', label: 'Clients', icon: 'clients' },
    ],
  },
];

/**
 * « /factures » ne doit pas s'allumer sur « /factures-recues » : la barre oblique ferme le
 * segment, donc le préfixe seul ne suffit pas. « /tableau-de-bord » est la seule page sans
 * sous-page connue.
 */
export function isCurrentPath(path, href) {
  if (!path || !href) return false;
  return path === href || (href !== '/tableau-de-bord' && path.startsWith(`${href}/`));
}

export function isSectionCurrent(path, section) {
  return section.items.some((item) => isCurrentPath(path, item.href));
}

export function findSectionOf(path) {
  return SIDEBAR_SECTIONS.find((section) => isSectionCurrent(path, section)) || null;
}

const value = (counts, key) => (key ? Number(counts?.[key]) || 0 : 0);

// Nombre de décisions à traiter dans la section : on ne garde que ce qui attend une décision.
// Un effectif ou une facture reçue sont des volumes, pas une alerte ; les ajouter ferait dire au
// chiffre affiché quelque chose qui n'a rien d'actionnable.
export function actionsInSection(section, counts = {}) {
  return section.items.reduce(
    (sum, item) => sum + (item.tone === 'action' ? value(counts, item.count) : 0),
    0,
  );
}

/**
 * Une page appartient à un espace si l'une de ses sections y est rattachée : c'est ce qui allume
 * l'entrée correspondante de la barre. Les pages sans espace (tableau de bord, création,
 * consultation d'un dossier) n'allument rien.
 */
export function isWorkspaceCurrent(path, workspace) {
  return workspace.sectionIds.some((id) => {
    const section = SIDEBAR_SECTIONS.find((candidate) => candidate.id === id);
    return section ? isSectionCurrent(path, section) : false;
  });
}

export function findWorkspaceOf(path) {
  return WORKSPACES.find((workspace) => isWorkspaceCurrent(path, workspace)) || null;
}

// Nombre de décisions en attente dans un espace : c'est le compteur de la barre et celui du
// tableau de bord, tous deux fondés sur la même règle.
export function actionsInWorkspace(workspace, counts = {}) {
  return workspace.sectionIds.reduce((sum, id) => {
    const section = SIDEBAR_SECTIONS.find((candidate) => candidate.id === id);
    return sum + (section ? actionsInSection(section, counts) : 0);
  }, 0);
}

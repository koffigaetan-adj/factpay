// État d'accès au portail d'un salarié, calculé à partir d'une ligne `employees`.
// Isolé dans un module sans base de données ni dépendance serveur : la liste des salariés est un
// composant client, et importer `lib/portal.js` y entraînerait la couche DB dans le navigateur.

export const PORTAL_NONE = 'aucun';
export const PORTAL_EXPIRED = 'expire';
export const PORTAL_ACTIVE = 'actif';
export const PORTAL_PENDING = 'en_attente';

/**
 * - 'actif'      : un lien existe, n'est pas échu et le salarié s'est déjà connecté ;
 * - 'en_attente' : un lien existe et est valide, en attente de la première connexion du salarié ;
 * - 'expire'     : un lien existe mais est échu, il faut le régénérer ;
 * - 'aucun'      : jamais activé.
 *
 * Un lien sans échéance est traité comme expiré : le portail ne doit jamais s'ouvrir sur une
 * échéance absente, c'est le même principe que dans `getEmployeeByPortalToken`.
 */
export function portalAccessState(employee, now = new Date()) {
  if (!employee || !employee.portal_token) return PORTAL_NONE;
  if (!employee.portal_token_expires_at) return PORTAL_EXPIRED;
  if (new Date(employee.portal_token_expires_at) <= now) return PORTAL_EXPIRED;
  if (!employee.portal_last_seen_at) return PORTAL_PENDING;
  return PORTAL_ACTIVE;
}

export const PORTAL_STATE_LABEL = {
  [PORTAL_ACTIVE]: 'Espace actif',
  [PORTAL_PENDING]: 'En attente',
  [PORTAL_EXPIRED]: 'Lien expiré',
  [PORTAL_NONE]: 'Aucun accès',
};

// Ancienneté de la dernière visite. Volontairement approximative : elle sert à juger d'un coup
// d'œil si un lien est encore vivant, pas à établir un calendrier.
export function portalLastSeenLabel(employee, now = new Date()) {
  if (!employee || !employee.portal_last_seen_at) return 'jamais ouvert';
  const days = Math.floor((now - new Date(employee.portal_last_seen_at)) / 86400000);
  if (days <= 0) return 'ouvert aujourd\'hui';
  if (days === 1) return 'ouvert hier';
  if (days < 31) return `ouvert il y a ${days} jours`;
  const months = Math.round(days / 30);
  return `ouvert il y a ${months} mois`;
}
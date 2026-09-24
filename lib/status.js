import { today } from './dates.js';

// Statuts d'un devis
function quoteStatus(inv) {
  switch (inv.status) {
    case 'acceptee': return { cls: 'paid', label: 'Accepté' };
    case 'convertie': return { cls: 'paid', label: 'Transformé en facture' };
    case 'refusee': return { cls: 'void', label: 'Refusé' };
    case 'brouillon': return { cls: 'draft', label: 'Brouillon' };
    case 'emise': return { cls: 'late', label: inv.send_error ? "Échec d'envoi" : 'Envoi en cours' };
    default: return inv.due_date && inv.due_date < today()
      ? { cls: 'late', label: 'Expiré, sans réponse' }
      : { cls: 'wait', label: 'En attente de réponse' };
  }
}

export function statusOf(inv) {
  if (inv.doc_type === 'devis') return quoteStatus(inv);
  switch (inv.status) {
    case 'payee': return { cls: 'paid', label: 'Payée' };
    case 'annulee': return { cls: 'void', label: 'Annulée' };
    case 'signalee': return { cls: 'check', label: 'Paiement signalé, à vérifier' };
    case 'brouillon': return { cls: 'draft', label: 'Brouillon' };
    case 'programmee': return { cls: 'draft', label: 'Envoi programmé' };
    case 'emise': return { cls: 'late', label: inv.send_error ? "Échec d'envoi" : 'Envoi en cours' };
    default: return inv.due_date && inv.due_date < today()
      ? { cls: 'late', label: 'En retard' }
      : { cls: 'wait', label: 'Envoyée, en attente' };
  }
}

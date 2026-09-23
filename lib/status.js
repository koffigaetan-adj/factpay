import { today } from './dates.js';

export function statusOf(inv) {
  switch (inv.status) {
    case 'payee': return { cls: 'paid', label: 'Payée' };
    case 'signalee': return { cls: 'check', label: 'Paiement signalé, à vérifier' };
    case 'brouillon': return { cls: 'draft', label: 'Brouillon' };
    case 'programmee': return { cls: 'draft', label: 'Envoi programmé' };
    case 'emise': return { cls: 'late', label: inv.send_error ? "Échec d'envoi" : 'Envoi en cours' };
    default: return inv.due_date && inv.due_date < today()
      ? { cls: 'late', label: 'En retard' }
      : { cls: 'wait', label: 'Envoyée, en attente' };
  }
}

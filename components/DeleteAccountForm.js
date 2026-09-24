'use client';

import { deleteAccount } from '@/app/actions';
import PasswordInput from '@/components/PasswordInput';
import SubmitButton from '@/components/SubmitButton';

// Un dernier « es-tu sûr ? » avant la suppression définitive du compte
export default function DeleteAccountForm() {
  return (
    <form action={deleteAccount} className="stack"
      onSubmit={(e) => { if (!confirm('Supprimer définitivement ton compte et toutes ses données ?')) e.preventDefault(); }}>
      <PasswordInput label="Mot de passe actuel" />
      <label>Tape SUPPRIMER pour confirmer<input name="confirm" required pattern="SUPPRIMER" autoComplete="off" placeholder="SUPPRIMER" /></label>
      <div><SubmitButton className="danger" pendingText="Suppression...">Supprimer définitivement mon compte</SubmitButton></div>
    </form>
  );
}

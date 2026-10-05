'use client';

import { deleteAccount } from '@/app/actions';
import PasswordInput from '@/components/PasswordInput';
import SubmitButton from '@/components/SubmitButton';
import Icon from '@/components/Icon';

// Confirmation avant la suppression définitive du compte
export default function DeleteAccountForm() {
  return (
    <form action={deleteAccount} className="stack">
      <p className="hint" style={{ margin: 0 }}>
        Ton entreprise, tes clients, tes factures et tous tes fichiers (photo, logo, documents) seront effacés <strong>définitivement</strong>. Cette action est irréversible.
      </p>
      <PasswordInput label="Mot de passe actuel" />
      <label>Tape SUPPRIMER pour confirmer<input name="confirm" required pattern="SUPPRIMER" autoComplete="off" placeholder="SUPPRIMER" /></label>
      <div className="form-actions">
        <SubmitButton className="danger" pendingText="Suppression..."><Icon name="trash" size={16} /> Supprimer définitivement mon compte</SubmitButton>
      </div>
    </form>
  );
}

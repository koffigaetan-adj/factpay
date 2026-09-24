'use client';

import { useRef, useState } from 'react';
import { saveAvatar } from '@/app/actions';
import Icon from '@/components/Icon';

// Photo de profil : on clique sur la pastille pour choisir une image, elle s'enregistre aussitôt.
// « Supprimer la photo » remet l'icône par défaut (le fichier est effacé définitivement).
export default function AvatarPicker({ url }) {
  const form = useRef(null);
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const pick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choisis une image PNG, JPEG ou WebP.'); return; }
    if (file.size > 1024 * 1024) { setError('La photo dépasse 1 Mo. Réduis sa taille et réessaie.'); return; }
    setError('');
    setPreview(URL.createObjectURL(file));
    form.current.requestSubmit();
  };

  const shown = preview || url;
  return (
    <div className="avatar-edit">
      <form action={saveAvatar} ref={form}>
        <button type="button" className="avatar-big" onClick={() => input.current.click()}
          aria-label={shown ? 'Changer la photo de profil' : 'Ajouter une photo de profil'}>
          {shown ? <img src={shown} alt="" width={96} height={96} /> : <Icon name="user" size={44} />}
          <span className="avatar-cam" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" />
            </svg>
          </span>
        </button>
        <input ref={input} name="avatar" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
      </form>
      <div className="avatar-side">
        <p className="hint" style={{ margin: 0 }}>{shown ? 'Clique sur ta photo pour la changer.' : 'Clique sur l\'icône pour ajouter ta photo.'} PNG, JPEG ou WebP, 1 Mo maximum.</p>
        {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
        {url && (
          <form action={saveAvatar} onSubmit={(e) => { if (!confirm('Supprimer ta photo ? Elle sera effacée définitivement et l\'icône par défaut reviendra.')) e.preventDefault(); }}>
            <input type="hidden" name="remove" value="1" />
            <button className="link danger-link">Supprimer la photo</button>
          </form>
        )}
      </div>
    </div>
  );
}

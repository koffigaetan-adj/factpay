'use client';

import { useEffect, useRef } from 'react';
import Icon from './Icon';

// Fenêtre par-dessus la page (élément <dialog> du navigateur) : un bouton l'ouvre,
// la croix, la touche Échap ou un clic à côté la ferment. Elle se referme aussi à l'envoi du formulaire.
// `openInitially` l'ouvre au chargement : le bouton principal de la barre latérale mène alors
// directement au formulaire, sans second clic dans le vide.
export default function Modal({ label, icon, title, buttonClass = '', openInitially = false, children }) {
  const dialog = useRef(null);
  const close = () => dialog.current?.close();

  useEffect(() => {
    if (openInitially) dialog.current?.showModal();
  }, [openInitially]);

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => dialog.current?.showModal()}>
        {icon && <Icon name={icon} size={16} />}
        {label}
      </button>
      <dialog ref={dialog} className="modal" aria-label={title}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        onSubmit={() => setTimeout(close, 0)}>
        <div className="modal-box">
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="modal-close" onClick={close} aria-label="Fermer">×</button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

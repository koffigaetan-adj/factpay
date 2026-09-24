'use client';

import { useRef } from 'react';

// Fenêtre par-dessus la page (élément <dialog> du navigateur) : un bouton l'ouvre,
// la croix, la touche Échap ou un clic à côté la ferment. Elle se referme aussi à l'envoi du formulaire.
export default function Modal({ label, title, buttonClass = '', children }) {
  const dialog = useRef(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => dialog.current?.showModal()}>{label}</button>
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

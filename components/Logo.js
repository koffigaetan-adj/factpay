// Logo FactPay.
// « onDark » : toujours la version blanche (barre du haut, bandeaux sombres).
// Sinon : les deux versions sont dans la page, la feuille de style montre celle qui convient
// au mode clair ou sombre (réglage de l'appareil, ou choix fait dans Paramètres → Apparence).
export default function Logo({ onDark = false, height = 40, priority = false }) {
  const width = Math.round(height * 1.61);
  const img = (src, className) => (
    <img src={src} alt="FactPay" width={width} height={height} className={className}
      style={{ height, width: 'auto' }} fetchPriority={priority ? 'high' : undefined} />
  );
  if (onDark) return img('/logo_factpay_light.png');
  return (
    <>
      {img('/logo_factpay_dark.png', 'logo-for-light')}
      {img('/logo_factpay_light.png', 'logo-for-dark')}
    </>
  );
}

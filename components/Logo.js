import Image from 'next/image';

// Logo FactPay. « onDark » : version blanche, pour les fonds sombres (barre de navigation).
export default function Logo({ onDark = false, height = 40, priority = false }) {
  return (
    <Image
      src={onDark ? '/logo_factpay_light.png' : '/logo_factpay_dark.png'}
      alt="FactPay"
      width={Math.round(height * 1.61)}
      height={height}
      priority={priority}
    />
  );
}

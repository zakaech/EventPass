import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import styles from './TicketQr.module.css';

/**
 * QR code d'un billet. `value` est le jeton signé fourni par l'API ("EP1.…") : le QR ne fait
 * que le transporter, toute la sécurité vient de la signature vérifiée par le serveur.
 * La génération est asynchrone (image PNG en data URL), d'où l'effet + l'état local.
 */
export function TicketQr({ value, size = 200, label = 'QR code du billet' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let ignore = false;
    QRCode.toDataURL(value, {
      width: size * 2, // résolution doublée pour les écrans haute densité
      margin: 1,
      errorCorrectionLevel: 'M', // lisible même si ~15 % du code est abîmé ou masqué
      color: { dark: '#16182d', light: '#ffffff' },
    }).then((url) => {
      if (!ignore) setSrc(url);
    });
    return () => {
      ignore = true;
    };
  }, [value, size]);

  return (
    <span className={styles.frame} style={{ width: size, height: size }}>
      {src ? <img src={src} alt={label} width={size} height={size} /> : null}
    </span>
  );
}

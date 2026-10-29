// Fausse caméra pour les tests : Chromium peut remplacer la webcam par un fichier vidéo
// (--use-file-for-fake-video-capture). On fabrique ici une vidéo Y4M qui montre un QR code.
//
// Y4M = en-tête texte, puis des images brutes au format YUV 4:2:0 :
//   - plan Y (luminosité) : 1 octet par pixel → le QR en noir et blanc ;
//   - plans U et V (couleur) : 1 octet pour 2×2 pixels → 128 = aucune couleur (gris neutre).
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 15; // Chromium lit le fichier en boucle

export function writeQrVideo(text, path) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const moduleSize = Math.floor((HEIGHT * 0.75) / modules.size);
  const qrPixels = modules.size * moduleSize;
  const offsetX = Math.floor((WIDTH - qrPixels) / 2);
  const offsetY = Math.floor((HEIGHT - qrPixels) / 2);

  const luma = Buffer.alloc(WIDTH * HEIGHT, 235); // fond blanc
  for (let y = 0; y < qrPixels; y++) {
    for (let x = 0; x < qrPixels; x++) {
      const dark = modules.get(Math.floor(y / moduleSize), Math.floor(x / moduleSize));
      if (dark) luma[(offsetY + y) * WIDTH + offsetX + x] = 16;
    }
  }
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128);

  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F15:1 Ip A1:1 C420jpeg\n`);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  writeFileSync(path, Buffer.concat([header, ...Array(FRAMES).fill(frame)]));
}

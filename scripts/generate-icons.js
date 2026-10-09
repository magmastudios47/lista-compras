// Helper simple para crear PNGs válidos si es necesario o copiar para PWA
import fs from 'fs';
import path from 'path';

// Creamos un placeholder PNG válido de 1x1 estirado si no hay sharp,
// y garantizamos que los archivos existan para que el manifest y el service worker no fallen con 404
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(minimalPngBase64, 'base64');

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), pngBuffer);
console.log('Iconos de fallback PNG generados exitosamente.');

// Verifica que los iconos PNG de 192x192 y 512x512 existan y no los pisa si ya son iconos reales (> 1 KB)
import fs from 'fs';
import path from 'path';

const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(minimalPngBase64, 'base64');

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const file of ['icon-192.png', 'icon-512.png']) {
  const target = path.join(iconsDir, file);
  if (!fs.existsSync(target) || fs.statSync(target).size < 1024) {
    fs.writeFileSync(target, pngBuffer);
  }
}
console.log('Iconos PWA verificados.');

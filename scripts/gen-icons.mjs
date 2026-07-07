import sharp from 'sharp';
import { mkdirSync } from 'fs';

// A clay target (the disc shot at in skeet/trap) rather than an abstract
// monogram — it's the one symbol every clay shooter recognizes instantly,
// and its shape (a simple tilted dome) still reads clearly at 40px.
const svg = () => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#37402E"/>
      <stop offset="100%" stop-color="#262E1E"/>
    </linearGradient>
    <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D97A46"/>
      <stop offset="100%" stop-color="#9C4720"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" fill="url(#bg)"/>

  <g transform="translate(256,268) rotate(-10)">
    <!-- motion streak -->
    <path d="M -230,55 L -120,30" stroke="#C7B384" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
    <path d="M -215,90 L -130,68" stroke="#C7B384" stroke-width="8" stroke-linecap="round" opacity="0.22"/>

    <!-- the clay target disc -->
    <ellipse cx="0" cy="14" rx="188" ry="108" fill="#7A3417"/>
    <ellipse cx="0" cy="0" rx="188" ry="108" fill="url(#clay)"/>
    <ellipse cx="0" cy="-8" rx="150" ry="76" fill="#E8A16C" opacity="0.4"/>
    <ellipse cx="0" cy="0" rx="188" ry="108" fill="none" stroke="#5C2A12" stroke-width="6" opacity="0.5"/>
  </g>
</svg>`;

mkdirSync('public', { recursive: true });

const targets = [
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(Buffer.from(svg())).resize(size, size).png().toFile(file);
  console.log(`wrote ${file}`);
}

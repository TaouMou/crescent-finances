#!/usr/bin/env node
// Generates all Android launcher icons and PWA icons from SVG sources in resources/.
// Run with: node scripts/generate-icons.mjs
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const srcFull = join(root, 'resources/icon.svg');
const srcFg   = join(root, 'resources/icon-fg.svg');

function resize(input, output, size) {
  execSync(`npx sharp-cli -i "${input}" -o "${output}" resize ${size}`, { stdio: 'inherit' });
}

const densities = [
  { name: 'mdpi',    launcher: 48,  fg: 108  },
  { name: 'hdpi',    launcher: 72,  fg: 162  },
  { name: 'xhdpi',   launcher: 96,  fg: 216  },
  { name: 'xxhdpi',  launcher: 144, fg: 324  },
  { name: 'xxxhdpi', launcher: 192, fg: 432  },
];

for (const { name, launcher, fg } of densities) {
  const dir = join(root, `android/app/src/main/res/mipmap-${name}`);
  console.log(`→ ${name} (launcher: ${launcher}px, fg: ${fg}px)`);
  resize(srcFull, join(dir, 'ic_launcher.png'),            launcher);
  resize(srcFull, join(dir, 'ic_launcher_round.png'),      launcher);
  resize(srcFg,   join(dir, 'ic_launcher_foreground.png'), fg);
}

// PWA icons
const publicDir = join(root, 'public/icons');
console.log('→ PWA icons');
resize(srcFull, join(publicDir, 'icon-192.png'), 192);
resize(srcFull, join(publicDir, 'icon-512.png'), 512);

console.log('✓ Done');

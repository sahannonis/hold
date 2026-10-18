// Builds dist/ for the Android app from www/index.html:
//  - wraps the page in a full HTML document (the artifact host adds this for the web version)
//  - swaps the Google Fonts link for font files bundled inside the app, so it works offline
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'www', 'index.html');
const out = join(root, 'dist');
const nm = process.env.NODE_MODULES_DIR || join(root, 'node_modules');

// family, fontsource package, weights
const FONTS = [
  ['Big Shoulders Display', 'big-shoulders-display', [700, 900]],
  ['DM Mono', 'dm-mono', [400, 500]],
  ['Instrument Sans', 'instrument-sans', [400, 600]],
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

let faces = '';
for (const [family, pkg, weights] of FONTS) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    const from = join(nm, '@fontsource', pkg, 'files', file);
    if (!existsSync(from)) throw new Error(`Missing font file ${from}. Run npm install first.`);
    copyFileSync(from, join(out, 'fonts', file));
    faces += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url("fonts/${file}") format("woff2")}\n`;
  }
}

let page = readFileSync(src, 'utf8');
const before = page.length;
page = page.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
if (page.length === before) throw new Error('Expected Google Fonts links in www/index.html');

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0e0b10">
<style>
${faces}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0}
</style>
</head>
<body>
${page}
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), doc);
console.log(`dist/index.html written (${doc.length} bytes) with ${FONTS.reduce((n, f) => n + f[2].length, 0)} bundled fonts`);

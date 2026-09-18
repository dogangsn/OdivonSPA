// Builds heroicons sprite sheets consumed by MatIconRegistry.addSvgIconSetInNamespace
// so templates can use [svgIcon]="'heroicons_outline:x-mark'" / 'heroicons_solid:...' as in the
// Odivon design system reference files.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(rootDir, '..');
const heroiconsDir = path.join(projectRoot, 'node_modules', 'heroicons', '24');
const outDir = path.join(projectRoot, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

function buildSprite(variant) {
  const srcDir = path.join(heroiconsDir, variant);
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.svg'));
  const symbols = files.map((file) => {
    const name = file.replace(/\.svg$/, '');
    const raw = readFileSync(path.join(srcDir, file), 'utf8');
    const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    return `<symbol id="${name}" viewBox="${viewBox}">${inner}</symbol>`;
  });
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`;
  const outFile = path.join(outDir, `heroicons-${variant}.svg`);
  writeFileSync(outFile, sprite, 'utf8');
  console.log(`Wrote ${files.length} icons -> ${path.relative(projectRoot, outFile)}`);
}

buildSprite('outline');
buildSprite('solid');

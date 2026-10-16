import { writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const gitDir = resolve(root, '.git');
const hooksDir = resolve(gitDir, 'hooks');
const preCommitPath = resolve(hooksDir, 'pre-commit');

if (!existsSync(gitDir)) {
  console.log('[Git Hook] .git dizini bulunamadı, hook kurulumu atlandı.');
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true });
}

const hookScript = `#!/bin/sh
# OdivonSPA Otomatik Sürüm Yükseltme (Patch Bump) Hook
node scripts/bump-version.mjs
`;

try {
  writeFileSync(preCommitPath, hookScript, { encoding: 'utf8', mode: 0o755 });
  try {
    chmodSync(preCommitPath, 0o755);
  } catch {}
  console.log('✅ [Git Hook] pre-commit kancası başarıyla kuruldu (.git/hooks/pre-commit)');
} catch (err) {
  console.error('[Git Hook] pre-commit kancası yazılamadı:', err);
}

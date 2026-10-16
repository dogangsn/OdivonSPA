import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pkgUrl = new URL('package.json', root);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));

// Semver x.y.z parse and increment patch
const semver = pkg.version.split('.').map(Number);
if (semver.length === 3 && !semver.some(isNaN)) {
  const oldVersion = pkg.version;
  semver[2] += 1; // Increment patch
  const newVersion = semver.join('.');
  pkg.version = newVersion;
  writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`\n🚀 [Auto-Version Hook] Sürüm otomatik güncellendi: v${oldVersion} ➔ v${newVersion}`);

  // Sync package-lock.json if exists
  try {
    const lockUrl = new URL('package-lock.json', root);
    const lock = JSON.parse(readFileSync(lockUrl, 'utf8'));
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = newVersion;
    }
    writeFileSync(lockUrl, JSON.stringify(lock, null, 2) + '\n');
  } catch {}

  // Regenerate build-info.generated.ts and public/version.json
  try {
    execSync('node scripts/write-version.mjs', { cwd: root, stdio: 'inherit' });
  } catch (err) {
    console.error('write-version hatası:', err);
  }

  // Stage changes if git is available
  try {
    execSync('git add package.json package-lock.json public/version.json src/app/core/version/build-info.generated.ts', { cwd: root });
  } catch {}
}

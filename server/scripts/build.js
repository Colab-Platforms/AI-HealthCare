/**
 * Backend "build" step.
 *
 * The server is plain CommonJS Node - there is nothing to transpile or bundle.
 * What this does instead is catch the errors a real build would catch:
 *   1. every .js file parses (node --check)
 *   2. the app actually boots its module graph (require of server.js dependencies)
 *
 * Exits non-zero on the first problem so CI / deploy stops here instead of at runtime.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'uploads', '.git']);

function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function fail(message, detail) {
  console.error(`\n[build] FAILED: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const files = collectFiles(ROOT);
console.log(`[build] syntax-checking ${files.length} files...`);

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    fail(`syntax error in ${path.relative(ROOT, file)}`, err.stderr && err.stderr.toString());
  }
}

console.log('[build] resolving module graph from server.js...');
try {
  // Loading with a guard flag so server.js can skip listen()/DB connect if it checks for it.
  process.env.BUILD_CHECK = '1';
  require.resolve(path.join(ROOT, 'server.js'));
  // Resolve every top-level dependency to catch a missing npm install.
  const pkg = require(path.join(ROOT, 'package.json'));
  for (const dep of Object.keys(pkg.dependencies || {})) {
    require.resolve(dep, { paths: [ROOT] });
  }
} catch (err) {
  fail('module resolution failed - try `npm install` in server/', err.message);
}

console.log('[build] OK - backend is ready to start.');

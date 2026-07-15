'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const EXCLUDED_DIRS = new Set([
  '.git', 'backup', 'config', 'dist', 'installer', 'logs', 'media', 'node_modules', 'node', 'node-portable',
  'state', 'venv', 'output', '__pycache__', 'models', 'installer/output',
]);
const INCLUDED_EXTENSIONS = new Set([
  '.js', '.json', '.py', '.ps1', '.cmd', '.bat', '.md', '.html', '.css', '.txt',
  '.yaml', '.yml', '.woff2', '.png', '.ico', '.svg',
]);
const ROOT_FILES = new Set(['index.js', 'package.json', 'package-lock.json', 'run-amano.bat', 'install.bat']);

function normalize(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function shouldExclude(relativePath, isDirectory) {
  const normalized = normalize(relativePath);
  const parts = normalized.split('/');
  if (normalized === 'release.json') return true;
  if (parts.some(part => EXCLUDED_DIRS.has(part))) return true;
  if (normalized.startsWith('installer/output/')) return true;
  if (isDirectory) return false;
  if (ROOT_FILES.has(normalized)) return false;
  return !INCLUDED_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function walk(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute);
    if (shouldExclude(relative, entry.isDirectory())) continue;
    if (entry.isDirectory()) walk(root, absolute, files);
    else files.push(normalize(relative));
  }
  return files;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gitState(root) {
  try {
    const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit, dirty: status.length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

function buildManifest(root) {
  const files = walk(root).sort().map(relativePath => ({
    path: relativePath,
    sha256: sha256(path.join(root, relativePath)),
    bytes: fs.statSync(path.join(root, relativePath)).size,
  }));
  const contentDigest = crypto.createHash('sha256')
    .update(files.map(file => `${file.sha256}  ${file.path}\n`).join(''))
    .digest('hex');
  const source = gitState(root);
  return {
    schemaVersion: 1,
    releaseId: `amano-resilience-${contentDigest.slice(0, 12)}`,
    commit: source.commit,
    sourceDirty: source.dirty,
    contentDigest,
    createdAt: new Date().toISOString(),
    packageScope: 'versioned-code-and-assets',
    runtimeRequirements: [
      'config/template-amano-brasilia.json',
      'node/node.exe|node-portable/node.exe',
      'node_modules',
      'clusters/cv/python/venv',
      'clusters/cv/python/models',
    ],
    files,
  };
}

function parseArgs(argv) {
  const get = name => {
    const direct = argv.find(arg => arg.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    root: path.resolve(get('--root') || path.join(__dirname, '..')),
    output: get('--output'),
    write: argv.includes('--write'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = buildManifest(args.root);
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (args.write || args.output) {
    const output = path.resolve(args.output || path.join(args.root, 'release.json'));
    fs.writeFileSync(output, json);
    console.log(`${manifest.releaseId} ${output}`);
  } else {
    process.stdout.write(json);
  }
}

if (require.main === module) main();

module.exports = { buildManifest, shouldExclude, walk };

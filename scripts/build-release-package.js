'use strict';

const fs = require('fs');
const path = require('path');
const { buildManifest } = require('./release-manifest');

function copyFile(root, output, relative) {
  const source = path.join(root, relative);
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function assertSafeOutput(root, output) {
  const distRoot = path.join(root, 'dist') + path.sep;
  const safeExternalName = path.basename(output).startsWith('aya-expo-tools-');
  if (output === root || root.startsWith(output + path.sep) || (!output.startsWith(distRoot) && !safeExternalName)) {
    throw new Error(`Unsafe package output path: ${output}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const output = path.resolve(outputArg ? outputArg.slice('--output='.length) : path.join(__dirname, '..', 'dist', 'release'));
  const root = path.resolve(__dirname, '..');
  assertSafeOutput(root, output);
  const manifest = buildManifest(root);
  if (manifest.sourceDirty && !args.includes('--allow-dirty')) {
    throw new Error('Refusing to package a dirty source tree');
  }

  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of manifest.files) copyFile(root, output, file.path);
  fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${manifest.releaseId} files=${manifest.files.length} output=${output}`);
}

if (require.main === module) main();

module.exports = { copyFile, assertSafeOutput };

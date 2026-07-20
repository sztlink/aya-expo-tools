'use strict';

const fs = require('fs');
const path = require('path');

async function getDirSize(dirPath) {
  let totalBytes = 0;
  let totalFiles = 0;
  let directory;
  try {
    directory = await fs.promises.opendir(dirPath);
  } catch {
    return { bytes: 0, mb: 0, files: 0 };
  }

  try {
    for await (const entry of directory) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = await getDirSize(fullPath);
        totalBytes += sub.bytes;
        totalFiles += sub.files;
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          totalBytes += stat.size;
          totalFiles++;
        } catch { /* file changed during scan */ }
      }
    }
  } catch { /* directory changed during scan */ }

  return { bytes: totalBytes, mb: Math.round(totalBytes / 1024 / 1024), files: totalFiles };
}

async function getFolderSizes(folders) {
  const result = {};
  await Promise.all(Object.entries(folders).map(async ([name, dirPath]) => {
    result[name] = await getDirSize(dirPath);
  }));
  return result;
}

module.exports = { getDirSize, getFolderSizes };

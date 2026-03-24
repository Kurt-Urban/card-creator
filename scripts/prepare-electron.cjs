/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const packedStandaloneRoot = path.join(root, ".next", "standalone-packed");
const standaloneNextDir = path.join(standaloneRoot, ".next");

const sourceStaticDir = path.join(root, ".next", "static");
const targetStaticDir = path.join(standaloneNextDir, "static");

const sourcePublicDir = path.join(root, "public");
const targetPublicDir = path.join(standaloneRoot, "public");

function ensureExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Required directory not found: ${dirPath}`);
  }
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function copyDereferencedEntry(sourcePath, targetPath) {
  const stats = fs.lstatSync(sourcePath);

  if (stats.isSymbolicLink()) {
    let realPath;
    try {
      realPath = fs.realpathSync(sourcePath);
    } catch {
      return;
    }

    copyDereferencedEntry(realPath, targetPath);
    return;
  }

  if (stats.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyDereferencedEntry(
        path.join(sourcePath, entry),
        path.join(targetPath, entry),
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirDereferenced(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  copyDereferencedEntry(sourceDir, targetDir);
}

function main() {
  ensureExists(standaloneRoot);
  ensureExists(sourceStaticDir);
  ensureExists(sourcePublicDir);

  copyDir(sourceStaticDir, targetStaticDir);
  copyDir(sourcePublicDir, targetPublicDir);
  copyDirDereferenced(standaloneRoot, packedStandaloneRoot);

  console.log("Prepared Electron standalone assets:");
  console.log(`- ${targetStaticDir}`);
  console.log(`- ${targetPublicDir}`);
  console.log(`- ${packedStandaloneRoot} (dereferenced for packaging)`);
}

main();

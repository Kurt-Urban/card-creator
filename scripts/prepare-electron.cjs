/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const standaloneRoot = path.join(root, '.next', 'standalone');
const packedStandaloneRoot = path.join(root, '.next', 'standalone-packed');
const standaloneNextDir = path.join(standaloneRoot, '.next');

const sourceStaticDir = path.join(root, '.next', 'static');
const targetStaticDir = path.join(standaloneNextDir, 'static');

const sourcePublicDir = path.join(root, 'public');
const targetPublicDir = path.join(standaloneRoot, 'public');

function ensureExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Required directory not found: ${dirPath}`);
  }
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function copyDirDereferenced(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  // dereference:true follows symlinks AND Windows NTFS junctions when copying,
  // producing real files with no pointers into the pnpm virtual store.
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    force: true,
    errorOnExist: false,
    filter: (src) => {
      // Skip dangling symlinks (can appear in pnpm stores) to avoid ENOENT.
      const stat = fs.lstatSync(src);
      if (!stat.isSymbolicLink()) return true;
      try {
        fs.realpathSync(src);
        return true;
      } catch {
        return false;
      }
    },
  });
}

function hasPackagedDependency(packageName, nodeModulesDir) {
  const flatPackagePath = path.join(
    nodeModulesDir,
    packageName,
    'package.json',
  );
  if (fs.existsSync(flatPackagePath)) {
    return true;
  }

  const pnpmDir = path.join(nodeModulesDir, '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    return false;
  }

  for (const entry of fs.readdirSync(pnpmDir)) {
    const packagePath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      packageName,
      'package.json',
    );
    if (fs.existsSync(packagePath)) {
      return true;
    }
  }

  return false;
}

function main() {
  ensureExists(standaloneRoot);
  ensureExists(sourceStaticDir);
  ensureExists(sourcePublicDir);

  copyDir(sourceStaticDir, targetStaticDir);
  copyDir(sourcePublicDir, targetPublicDir);

  // Copy standalone output
  copyDirDereferenced(standaloneRoot, packedStandaloneRoot);

  // Ensure traced runtime dependencies are bundled beside server.js.
  // Next standalone expects module resolution to work relative to this folder.
  const packedNodeModulesDir = path.join(packedStandaloneRoot, 'node_modules');
  if (!hasPackagedDependency('next', packedNodeModulesDir)) {
    throw new Error(
      `Invalid standalone output: could not find packaged Next runtime in ${packedNodeModulesDir}`,
    );
  }

  console.log('Prepared Electron standalone assets:');
  console.log(`- ${targetStaticDir}`);
  console.log(`- ${targetPublicDir}`);
  console.log(`- ${packedStandaloneRoot} (dereferenced for packaging)`);
}

main();

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const standaloneRoot = path.join(root, '.next', 'standalone');
const packedStandaloneRoot = path.join(root, '.next', 'standalone-packed');
const packedStandaloneDepsRoot = path.join(root, '.next', 'standalone-deps');
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

function main() {
  ensureExists(standaloneRoot);
  ensureExists(sourceStaticDir);
  ensureExists(sourcePublicDir);

  copyDir(sourceStaticDir, targetStaticDir);
  copyDir(sourcePublicDir, targetPublicDir);

  // Copy standalone output
  copyDirDereferenced(standaloneRoot, packedStandaloneRoot);

  // Copy project node_modules to standalone for runtime dependencies
  const projectNodeModulesDir = path.join(root, 'node_modules');
  const packedNodeModulesDir = path.join(packedStandaloneRoot, 'node_modules');

  fs.rmSync(packedStandaloneDepsRoot, { recursive: true, force: true });

  // Try to use existing node_modules from packed standalone first (from old builds)
  // If it doesn't exist, copy from project root
  if (fs.existsSync(packedNodeModulesDir)) {
    fs.renameSync(packedNodeModulesDir, packedStandaloneDepsRoot);
  } else if (fs.existsSync(projectNodeModulesDir)) {
    console.log(
      'Copying project node_modules to standalone dependencies (pnpm v10+ structure)...',
    );
    // Copy entire node_modules including .pnpm virtual store structure (required for pnpm v10+)
    copyDirDereferenced(projectNodeModulesDir, packedStandaloneDepsRoot);
  } else {
    throw new Error(
      `Missing dependencies: neither ${packedNodeModulesDir} nor ${projectNodeModulesDir} found. ` +
        "Please run 'pnpm install' before building.",
    );
  }

  console.log('Prepared Electron standalone assets:');
  console.log(`- ${targetStaticDir}`);
  console.log(`- ${targetPublicDir}`);
  console.log(`- ${packedStandaloneRoot} (dereferenced for packaging)`);
  console.log(`- ${packedStandaloneDepsRoot} (packaged server dependencies)`);
}

main();

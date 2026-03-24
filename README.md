# Enchunted Card Creator

Cross-platform desktop card builder built with Next.js and Electron.

## Prerequisites

- Node.js 20 LTS
- pnpm 10+

Install dependencies:

```bash
pnpm install
```

If pnpm blocks Electron postinstall scripts on your machine, approve builds once:

```bash
pnpm approve-builds
```

## Run In Development (Electron Window)

This runs Next.js and Electron together:

```bash
pnpm dev
```

## Build Next.js Web App

```bash
pnpm build
```

## Build Desktop Installers

Electron packaging automatically runs a prep step that copies Next static/public
assets into the standalone output used by Electron.

Build both targets from your current OS settings:

```bash
pnpm build:app
```

Build macOS installer only:

```bash
pnpm build:mac
```

Build Windows installer only:

```bash
pnpm build:win
```

Output files are written to `dist-electron/`.

## Notes

- macOS builds generally need to be run on macOS.
- Windows builds generally need to be run on Windows.
- This project uses Next.js standalone output for Electron production runtime.
- Every push to `master` auto-creates a patch tag (`vX.Y.Z`) via GitHub Actions.
- Use the `Auto Tag Releases` workflow (Run workflow) with `bump = major` when you want a new major version.

<!-- DOWNLOAD_SECTION:START -->\n## Download Installers\n\nLatest release: [v0.1.5](https://github.com/Kurt-Urban/card-creator/releases/tag/v0.1.5)\n\n- Windows (.exe): Not available in latest release\n- macOS (.dmg): Not available in latest release\n\n<!-- INSTALLER_LINKS:START -->\nGenerated from release v0.1.5.\n<!-- INSTALLER_LINKS:END -->\n<!-- DOWNLOAD_SECTION:END -->

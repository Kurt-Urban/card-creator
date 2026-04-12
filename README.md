# Enchunted Card Creator

Cross-platform desktop card builder built with Vite, React, Tailwind CSS, and Electron.

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

This runs the Vite dev server and Electron together:

```bash
pnpm dev
```

## Build Web App

```bash
pnpm build
```

## Build Desktop App

Build an unpacked desktop app for your current OS:

```bash
pnpm build:app
```

## Build Desktop Installers

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
- `build:app` creates an unpacked app directory for local validation.
- `build:win` and `build:mac` create installer artifacts.
- Every push to `master` auto-creates a patch tag (`vX.Y.Z`) via GitHub Actions.
- Use the `Auto Tag Releases` workflow (Run workflow) with `bump = major` when you want a new major version.

<!-- DOWNLOAD_SECTION:START -->\n## Download Installers\n\nLatest release: [v0.1.13](https://github.com/Kurt-Urban/card-creator/releases/tag/v0.1.13)\n\n- Windows (.exe): Not available in latest release\n- macOS (.dmg): Not available in latest release\n\n<!-- INSTALLER_LINKS:START -->\nGenerated from release v0.1.13.\n<!-- INSTALLER_LINKS:END -->\n<!-- DOWNLOAD_SECTION:END -->

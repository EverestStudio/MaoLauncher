# MaoLauncher

Electron desktop launcher for the MaoPickMe Minecraft server.

## Features

- One-click Minecraft Java Edition **26.2** launch with Fabric Loader and bundled Java 25
- First launch automatically downloads the official game files, Fabric libraries, assets, and required runtime

- Minecraft and Fabric installation and launch
- Managed Fabric mod downloads with integrity checks
- Multiple offline profiles and Minecraft skin preview
- Live server player count and client ping
- Embedded server map, settings, console, and onboarding tour
- Windows NSIS build

## Requirements

- Node.js 22 or newer
- Windows for native testing; Linux builds require Wine for NSIS

## Development

```sh
npm ci
npm start
```

## Windows build

```sh
npm ci
npm run build:win
```

The installer is written to `dist/`. Generated builds and installed dependencies are not committed.

Current project version: **1.4.10**.

Before publishing, `npm run test:game` performs a clean installation preflight for Minecraft 26.2, validates Fabric, checks Java 25, and generates the launch arguments.

## GitHub Actions

The workflow in `.github/workflows/release.yml` builds on Windows using manual dispatch (Artifacts) or a `vX.Y.Z` tag (signed GitHub Release). The tag must match `package.json`. A release requires the repository secret `MAO_RELEASE_PRIVATE_KEY`, matching the public key in `github-release.json`. No private key is included. See the bundle's `GITHUB-SETUP.md` for repository layout and initial setup.

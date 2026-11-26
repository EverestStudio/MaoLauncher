# MaoLauncher

Electron desktop launcher for the MaoPickMe Minecraft server.

## Features

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

Current project version: **0.1.12**.

## GitHub Actions

The workflow in `.github/workflows/release.yml` builds on Windows using manual dispatch (Artifacts) or a `vX.Y.Z` tag (signed GitHub Release). The tag must match `package.json`. A release requires the repository secret `MAO_RELEASE_PRIVATE_KEY`, matching the public key in `github-release.json`. No private key is included. See the bundle's `GITHUB-SETUP.md` for repository layout and initial setup.

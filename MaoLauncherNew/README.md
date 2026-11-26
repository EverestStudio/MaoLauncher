# MaoLauncher

Electron desktop launcher for the MaoPickMe Minecraft server.

## Features

- One-click Minecraft Java Edition **26.2** launch with Fabric Loader and bundled Java 25
- First launch automatically downloads the official game files, Fabric libraries, assets, and required runtime
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

`.github/workflows/build-launcher.yml` builds the Windows launcher and installer on pushes and pull requests. `.github/workflows/release.yml` publishes a versioned Windows x64 release when manually started from Actions with a version such as `1.4.10`. It runs the Minecraft 26.2 / Fabric / Java 25 installation preflight before packaging the launcher ZIP, SHA-256 checksum, and setup EXE.

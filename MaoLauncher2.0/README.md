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

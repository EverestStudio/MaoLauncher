# MaoLauncher

Custom Minecraft launcher for MaoPickMe server.

## Repository layout

- `MaoLauncher-Setup/` — Windows bootstrapper source (C# / .NET 10).
- `MaoLauncher/` — main Electron launcher source (to be added from the source archive).
- `.github/workflows/` — automated Windows builds and release publishing (to be configured).

## Bootstrapper prototype

The setup application checks the latest GitHub Release in this repository, downloads the Windows x64 ZIP and its SHA-256 sidecar, verifies the archive, extracts it to a staging directory, installs it under `%LOCALAPPDATA%\Programs\MaoLauncher`, creates a desktop shortcut when Windows Script Host is available, and starts the launcher.

See [MaoLauncher-Setup/README.md](MaoLauncher-Setup/README.md) for build instructions and the expected release asset names.

## Current status

The bootstrapper source is an initial prototype. No launcher release is published yet, and the main launcher source has not yet been imported into this repository. The bootstrapper therefore reports a clear message until a compatible GitHub Release exists.

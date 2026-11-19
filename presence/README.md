# MaoLauncher Presence (Minecraft 26.2)

This repository contains the client mod, Paper plugin and resource-pack source for the cosmetic MaoLauncher marker in the player list.

## Important limitation

The marker is a cosmetic client-origin hint, not an anti-cheat or proof of identity. A modified client can send the same plugin message. The random per-launch token prevents accidental/static reuse but is not a cryptographic attestation mechanism.

## Build

Requirements: Java 25 and Gradle 9.5.1.

- Client mod: `cd presence-mod && gradle build`
- Paper plugin: `cd presence-plugin && gradle build`

Artifacts are written to each project's `build/libs` directory.

## Install on the server

1. Copy `presence-plugin/build/libs/MaoLauncherPresence-1.0.0.jar` to the Paper server's `plugins/` folder.
2. Zip the contents of `resource-pack/` (not the folder itself) and host the ZIP at a direct HTTPS URL.
3. Put that URL in `plugins/MaoLauncherPresence/config.yml` under `resource-pack.url`. Optionally set the SHA-1 and `required: true`.
4. Restart Paper.

The font glyph is U+E000. The icon texture is based on MaoLauncher's existing icon asset.

## Launcher integration

The launcher must install `mao-launcher-presence-1.0.0.jar` into the game `mods/` directory and pass a fresh 64-character hex token as a JVM argument:

```
-Dmao.launcher.presence=<random-64-hex-token>
```

The mod sends that token to the Paper plugin on joining a server that registers the `mao:presence` plugin channel. The server then adds U+E000 before that player's Tab name.

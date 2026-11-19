# MaoLauncher Presence

Companion mod and plugin for Minecraft 26.2.

- The client-only Fabric mod sends a short `mao:presence` payload after joining when the launcher supplied `-Dmao.presence.token=<64 lowercase hex chars>`.
- The Paper plugin receives that payload and adds a gold star to the player's tab-list name. This is changed server-side, so everyone sees it.

## Build

Requires JDK 25 and Gradle 9.6.0.

```sh
gradle :fabric:build :paper:build
```

Artifacts:
- `fabric/build/libs/mao-presence-fabric-1.0.0.jar`
- `paper/build/libs/paper-1.0.0.jar`

Install the Fabric JAR in the launcher's managed `mods` directory and the Paper JAR in the server's `plugins` directory, then restart Paper.

## Trust model

The marker is cosmetic only. A client can imitate a custom payload, and a token generated locally by the launcher is not cryptographic proof of launcher provenance. Do not use this marker for permissions, moderation, anti-cheat, or account security. Strong verification requires a server-controlled one-time registration endpoint and a protected delivery channel.

# MaoLauncherBadge

Paper plugin for Minecraft Java **26.2**. Requires **Java 25**.

The plugin displays a purple diamond before the nickname:
- above the player's head (scoreboard team prefix);
- in the TAB player list (Adventure player-list name).

A badge is granted only after the server verifies a short-lived Ed25519-signed ticket sent by the launcher over the `mao:badge` plugin-message channel. A nickname, client-side setting, or unsigned message cannot grant the badge.

## Build

Install JDK 25 and Maven, then run from this directory:

```bash
mvn clean package
```

The plugin JAR will be in `target/mao-launcher-badge-1.0.0-SNAPSHOT.jar`.

Copy it to the server's `plugins/` directory and restart Paper.

## Key setup

The authentication backend must own an Ed25519 key pair:
- put only the **Base64 X.509 public key** in `plugins/MaoLauncherBadge/config.yml` as `public-key`;
- keep the private key exclusively on the trusted backend;
- do not embed the private key in MaoLauncher or distribute it with the plugin.

The plugin intentionally grants no badges until a valid public key is configured.

## Ticket protocol

Channel: `mao:badge`

UTF-8 message format:

```
base64url(utf8(uuid|expiryEpochSeconds|nonce)).base64url(ed25519Signature)
```

The signature is Ed25519 over the ASCII bytes of the first Base64URL segment (the encoded payload), without padding. The UUID must equal the connecting player's Mojang UUID. Expiry must be in the future and no more than the configured maximum lifetime away (default 180 seconds). Nonces are single-use for the lifetime of the server process.

The launcher must obtain this short-lived ticket from a trusted MaoLauncher authentication backend after authenticating the account, then send it to the server on `mao:badge` after the player joins. Do not treat a client-generated ticket as trusted.

## Admin

`/maobadge reload` reloads the configuration.

## Notes

The head-name prefix uses the main server scoreboard. Scoreboard teams are exclusive: if another plugin changes a verified player's team while the badge is active, that plugin may replace the badge prefix. The badge plugin remembers and restores the player's previous team on disconnect where possible.

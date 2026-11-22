# MaoAuth

MaoPickMe authentication plugin for Purpur/Paper servers.

## Current prototype (0.1.0)

- Inventory-based welcome menu.
- Login identity/password prompt through private chat input (password messages are cancelled and never broadcast).
- Credentials are checked by the MaoPickMe HTTPS API; passwords are not stored by this plugin.
- HMAC-signed short-lived token is verified locally and bound to the connecting player's UUID.
- Unauthenticated players are frozen and blocked from gameplay interactions and commands.

## Build

Requires JDK 21+ and Maven 3.9+:

```bash
mvn clean package
```

Copy `target/maoauth-0.1.0.jar` into the server's `plugins` folder, start once, then edit `plugins/MaoAuth/config.yml`.

Set `server-secret` to a random secret of at least 32 characters. The exact same value must be configured in the PHP API's private config. Never commit the real secret.

## Important: online-mode=false

In offline mode, Minecraft UUIDs are derived from player names and can be impersonated by anyone who can join using the same name. MaoAuth requires the MaoPickMe account password for this prototype, but UUID ownership is NOT cryptographically guaranteed by offline mode. For production, put the server behind Velocity with modern forwarding and secure the backend port so players cannot bypass the proxy. Do not expose the backend server directly.

## Not implemented yet

- Automatic MaoLauncher ticket exchange.
- Website-generated one-time Minecraft linking codes.
- Session persistence / remember-me.
- Full resource-pack GUI and localization.
- API endpoint deployment and end-to-end server testing.

This is an initial development build, not yet production-ready.

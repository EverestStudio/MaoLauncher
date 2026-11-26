# MaoLauncher 2.0

Current Electron application prepared in the development workspace: MaoLauncher 0.1.12.

## Import status

The new application sources have NOT been imported into this repository yet. The connector can write ordinary files, but rejects changes to `.github/workflows` with `Insufficient scope`. Consequently, the planned Actions-based import of the complete source bundle and binary image assets could not be activated.

Existing launcher and setup projects are preserved. This document is not the application source.

## Build requirements after import

Node.js 22, then `npm ci` and `npm run build:win` from the application directory. The output is an NSIS installer in `dist/`.

Signed GitHub update releases also require the matching Ed25519 key in the repository Actions secret `MAO_RELEASE_PRIVATE_KEY`; never commit the private key.

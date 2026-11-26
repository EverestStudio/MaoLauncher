# MaoLauncher 0.1.0
Windows x64 NSIS installer. UI adapted from main-launcher.html; original HTML is preserved.

Working: frameless Electron window, native minimize/close/drag, tray, persistent preferences and offline profile, folder picker, live log console, official Java 25 runtime install with SHA1 verification, Minecraft 26.2 + Fabric 0.20.1 installation and launch, real per-stage download progress, server player statistics.

Updater: electron-updater generic HTTPS provider, automatic download and explicit install/restart; release.json updateUrl must be configured before a production update feed can operate. No update endpoint is fabricated. Rebuild with actual release URL and publish installer + latest.yml + blockmap to that URL for future releases.

Still pending: MaoPickMe account authentication endpoint, support submission endpoint, real web map URL and news/streams API. Offline profiles do not provide Microsoft authentication; online-mode servers may reject them. Installer currently uses the NSIS wizard; the original HTML installer design is not a native installer yet. No Windows signing certificate is supplied.

Build with Node 22.22+: npm ci; npm run build:win. On Linux NSIS requires Wine including 32-bit support. postinstall corrects @xmcl/unzip 2.2.0 published main entry to existing dist/index.js.

Validated in Linux Electron with isolated test userData; profile creation, preferences, console and bridge. Minecraft client boot reached Render thread / Setting user with Java25 + Fabric26.2. Windows runtime manifest and platform library resolution validated separately. Full Windows GUI launch requires native Windows testing.

## 0.1.1
Direct Minecraft Status Ping (30s refresh), live Squaremap iframe with refresh, real download panel beside Play, hidden preserved news/stream templates, snow behind UI, logo diagonal shine, persistent multiple offline profiles with legacy migration and active selection. Electron integration checks passed for profile migration/creation/selection/restart, card visibility, map rendering and real ping. Native Windows testing remains pending.

## 0.1.2
Home headings restored with empty news/streams states; example records retained hidden. Fixed normal window size and native maximize/restore control. Profile selection popup anchored above sidebar profile button; create routes to creation page. Profile removal uses native confirmation and selects remaining profile when needed. Creation skin preview resolves a real Mojang account and fetches its face by UUID, with an explicit missing/unavailable state. Checks cover popup routing, selection, cancelled/confirmed deletion, fixed size and live Notch face lookup.

## 0.1.3
Initial bounds use the cursor display work area, centered and clamped with margins. Footer is pinned outside scrolling content. In-app styled deletion dialog replaces OS prompt. Default Steve face is bundled from the Minecraft 26.2 client skin, including empty-profile state. Skin preview constrained to 112px panel / 80px face / 11px hint. Snow layers are inside panel backgrounds with foreground content above them. No TPS is published by the current status/query or Squaremap endpoint; TPS stays unavailable until a server-side metrics integration is supplied. Integration verified on 1366x768.

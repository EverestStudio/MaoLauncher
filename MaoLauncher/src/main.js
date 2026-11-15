const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const dns = require('node:dns/promises');
const { performance } = require('node:perf_hooks');
const { Client } = require('minecraft-launcher-core');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const GAME_VERSION = '26.2';
const SERVER = 'mc.maopickme.ru';
const LAUNCHER_VERSION = '1.0.0';
const PROJECTS = [
  ['fabric-api', 'Fabric API'], ['modmenu', 'Mod Menu'], ['emotecraft', 'EmoteCraft'],
  ['simple-voice-chat', 'Simple Voice Chat'], ['chat-heads', 'Chat Heads'],
  ['entity-model-features', 'Entity Model Features'], ['entitytexturefeatures', 'Entity Texture Features'],
  ['player-animation-library', 'Player Animation Library'], ['sodium', 'Sodium'], ['iris', 'Iris'],
  ['litematica', 'Litematica'], ['journeymap', 'JourneyMap']
];
const PRESENCE_MOD_FILE = 'mao-launcher-presence-1.0.0.jar';
const DEFAULTS = { memory: 4096, theme: 'auto', language: 'ru', profiles: [], activeProfile: '', installManifest: '' };
let mainWindow;
let tray;
let quitting = false;
let settingsPath;
let gameRoot;
let installPromise;

function readSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(value) {
  const clean = { ...DEFAULTS, ...value };
  clean.memory = Math.max(2048, Math.min(32768, Number(clean.memory) || 4096));
  clean.theme = ['auto', 'light', 'dark'].includes(clean.theme) ? clean.theme : 'auto';
  clean.language = ['ru', 'en'].includes(clean.language) ? clean.language : 'ru';
  clean.profiles = Array.isArray(clean.profiles) ? clean.profiles.filter(p => p && /^[A-Za-z0-9_]{3,16}$/.test(p.name) && /^[0-9a-f-]{36}$/i.test(p.uuid)).map(p => ({ ...p, type: 'offline' })).slice(0, 20) : [];
  if (!clean.profiles.some(p => p.name === clean.activeProfile)) clean.activeProfile = clean.profiles[0]?.name || '';
  fs.writeFileSync(settingsPath, JSON.stringify(clean, null, 2));
  return clean;
}
async function api(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'MaoLauncher/1.0.0 (desktop launcher)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} при запросе к ${new URL(url).hostname}`);
  return response.json();
}
function emit(channel, data) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data); }
function profileUuid(name) {
  const bytes = crypto.createHash('md5').update(`OfflinePlayer:${name}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function varInt(value) {
  const parts = [];
  do { let byte = value & 0x7f; value >>>= 7; if (value) byte |= 0x80; parts.push(byte); } while (value);
  return Buffer.from(parts);
}
function readVarInt(buffer, offset = 0) {
  let value = 0, position = offset, byte;
  do { if (position >= buffer.length || position - offset > 5) throw new Error('Некорректный пакет статуса.'); byte = buffer[position++]; value |= (byte & 0x7f) << ((position - offset - 1) * 7); } while (byte & 0x80);
  return { value, next: position };
}
async function directServerStatus() {
  let host = SERVER, port = 25565;
  try { const srv = await dns.resolveSrv(`_minecraft._tcp.${SERVER}`); if (srv[0]) { host = srv[0].name.replace(/\.$/, ''); port = srv[0].port; } } catch {}
  const address = (await dns.lookup(host)).address;
  const addressBytes = Buffer.from(SERVER, 'utf8');
  const handshakeData = Buffer.concat([varInt(767), varInt(addressBytes.length), addressBytes, Buffer.from([port >> 8, port & 255]), varInt(1)]);
  const handshake = Buffer.concat([varInt(handshakeData.length + 1), Buffer.from([0]), handshakeData]);
  const request = Buffer.from([1, 0]);
  const packet = Buffer.concat([handshake, request]);
  const started = performance.now();
  const response = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: address, port });
    const chunks = []; let total = 0;
    const timer = setTimeout(() => socket.destroy(new Error('Тайм-аут ответа сервера.')), 4000);
    socket.on('connect', () => socket.write(packet));
    socket.on('data', chunk => { chunks.push(chunk); total += chunk.length; if (total >= 5) { try { const data = Buffer.concat(chunks, total); const length = readVarInt(data); const pid = readVarInt(data, length.next); if (pid.value !== 0) throw new Error('Сервер прислал неизвестный пакет.'); const jsonLength = readVarInt(data, pid.next); if (data.length >= jsonLength.next + jsonLength.value) { clearTimeout(timer); socket.end(); resolve(JSON.parse(data.subarray(jsonLength.next, jsonLength.next + jsonLength.value).toString('utf8'))); } } catch (error) { clearTimeout(timer); socket.destroy(); reject(error); } } });
    socket.on('error', error => { clearTimeout(timer); reject(error); });
  });
  return { online: true, players: response.players || {}, version: response.version?.name || GAME_VERSION, ping: Math.round(performance.now() - started), sample: response.players?.sample || [], motd: response.description?.text || '' };
}
async function measureServerPing() {
  let host = SERVER, port = 25565;
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${SERVER}`);
    if (records[0]) { host = records[0].name.replace(/\.$/, ''); port = records[0].port; }
  } catch {}
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => socket.destroy(new Error('Тайм-аут проверки пинга.')), 4000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(Math.round(performance.now() - started));
      socket.end();
    });
    socket.once('error', error => { clearTimeout(timer); reject(error); });
  });
}
let hostedStatusCache = null;
let hostedStatusUpdatedAt = 0;
let hostedStatusPromise = null;
async function hostedServerStatus() {
  if (hostedStatusCache && Date.now() - hostedStatusUpdatedAt < 60_000) return hostedStatusCache;
  if (hostedStatusPromise) return hostedStatusPromise;
  hostedStatusPromise = (async () => {
    const url = 'https://minecraft-hosting.net/resolve';
    const initial = await fetch(url);
    if (!initial.ok) throw new Error(`Minecraft-Hosting вернул HTTP ${initial.status}.`);
    const html = await initial.text();
    const token = html.match(/name="_token" value="([^"]+)"/)?.[1];
    if (!token) throw new Error('Не удалось прочитать форму статуса Minecraft-Hosting.');
    const cookies = initial.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin: 'https://minecraft-hosting.net', referer: url },
      body: new URLSearchParams({ _token: token, server_type: 'java', server_address: SERVER })
    });
    if (!response.ok) throw new Error(`Проверка сервера: HTTP ${response.status}.`);
    const result = await response.text();
    const online = /server-status-card server-online/.test(result);
    const field = label => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = result.match(new RegExp(`<span class="info-label">${escaped}:<\\/span>\\s*<span class="info-value">([\\s\\S]*?)<\\/span>`));
      return match?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
    };
    const [playersOnline, playersMax] = field('Игроки').split('/').map(value => Number(value.trim()));
    if (!field('Версия') || !Number.isFinite(playersOnline) || !Number.isFinite(playersMax)) {
      const offline = /server-status-card server-offline/.test(result);
      if (!offline) throw new Error('Формат ответа Minecraft-Hosting изменился.');
    }
    const value = {
      online,
      players: { online: Number.isFinite(playersOnline) ? playersOnline : 0, max: Number.isFinite(playersMax) ? playersMax : 0 },
      version: field('Версия') || GAME_VERSION,
      ping: null,
      sample: [],
      motd: '',
      source: 'minecraft-hosting.net'
    };
    hostedStatusCache = value;
    hostedStatusUpdatedAt = Date.now();
    return value;
  })();
  try { return await hostedStatusPromise; } finally { hostedStatusPromise = null; }
}
async function serverStatus() {
  const [hosted, direct, ping] = await Promise.allSettled([hostedServerStatus(), directServerStatus(), measureServerPing()]);
  if (hosted.status === 'fulfilled') {
    return { ...hosted.value, ping: ping.status === 'fulfilled' ? ping.value : null, sample: direct.status === 'fulfilled' ? direct.value.sample : [] };
  }
  if (direct.status === 'fulfilled') return direct.value;
  throw new Error(hosted.reason?.message || direct.reason?.message || 'Не удалось получить статус сервера.');
}
async function ensureJava() {
  if (process.platform !== 'win32') return 'java';
  const javaPath = path.join(gameRoot, 'runtime', 'java25', 'bin', 'java.exe');
  if (fs.existsSync(javaPath)) return javaPath;
  emit('install:progress', { stage: 'java', current: 0, total: 0, label: 'Загрузка Java 25 (требуется Minecraft 26.2)' });
  const assets = await api('https://api.adoptium.net/v3/assets/latest/25/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse');
  const pkg = assets[0]?.binary?.package;
  if (!pkg?.link || !pkg?.checksum) throw new Error('Не удалось получить официальный Java 25 runtime.');
  const response = await fetch(pkg.link);
  if (!response.ok) throw new Error(`Java runtime: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha256').update(archive).digest('hex') !== pkg.checksum) throw new Error('Проверка целостности Java 25 не пройдена.');
  const AdmZip = require('adm-zip');
  const tempDir = path.join(gameRoot, 'runtime', 'java25.tmp');
  fs.rmSync(tempDir, { recursive: true, force: true }); fs.mkdirSync(tempDir, { recursive: true });
  new AdmZip(archive).extractAllTo(tempDir, true);
  const top = fs.readdirSync(tempDir).find(entry => fs.existsSync(path.join(tempDir, entry, 'bin', 'java.exe')));
  if (!top) throw new Error('Архив Java не содержит bin/java.exe.');
  const finalDir = path.join(gameRoot, 'runtime', 'java25');
  fs.rmSync(finalDir, { recursive: true, force: true }); fs.renameSync(path.join(tempDir, top), finalDir); fs.rmSync(tempDir, { recursive: true, force: true });
  return path.join(finalDir, 'bin', 'java.exe');
}
async function modVersion(projectId) {
  const query = new URLSearchParams({ game_versions: JSON.stringify([GAME_VERSION]), loaders: JSON.stringify(['fabric']) });
  const versions = await api(`https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version?${query}`);
  if (!versions.length) throw new Error(`Для ${projectId} пока нет сборки Fabric ${GAME_VERSION}.`);
  return versions[0];
}
async function resolveMods() {
  const done = new Map();
  const visit = async (id, label) => {
    if (done.has(id)) return;
    const version = await modVersion(id);
    done.set(id, { id, label: label || id, version });
    for (const dep of version.dependencies || []) {
      if (dep.dependency_type === 'required' && dep.project_id) await visit(dep.project_id, dep.project_id);
    }
  };
  for (const [id, label] of PROJECTS) await visit(id, label);
  return [...done.values()];
}
function safeFileName(name) { return name.replace(/[^A-Za-z0-9._-]/g, '_'); }
async function downloadFile(url, destination, sha1) {
  if (!url.startsWith('https://')) throw new Error('Разрешены только HTTPS-ссылки модов.');
  if (fs.existsSync(destination) && (!sha1 || crypto.createHash('sha1').update(fs.readFileSync(destination)).digest('hex') === sha1)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Загрузка не удалась: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (sha1 && crypto.createHash('sha1').update(data).digest('hex') !== sha1) throw new Error('Контрольная сумма загруженного мода не совпала.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, data);
}
async function installMods(previousFiles = []) {
  const mods = await resolveMods();
  const dir = path.join(gameRoot, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  for (const oldFile of previousFiles) {
    if (typeof oldFile === 'string' && path.basename(oldFile) === oldFile && oldFile.endsWith('.jar')) fs.rmSync(path.join(dir, oldFile), { force: true });
  }
  const files = [];
  for (let i = 0; i < mods.length; i++) {
    const mod = mods[i];
    const file = mod.version.files.find(item => item.primary) || mod.version.files[0];
    if (!file) throw new Error(`У мода ${mod.label} не найден файл.`);
    emit('install:progress', { stage: 'mods', current: i + 1, total: mods.length, label: mod.label });
    const filename = safeFileName(file.filename);
    await downloadFile(file.url, path.join(dir, filename), file.hashes?.sha1);
    files.push(filename);
  }
  const presenceSource = app.isPackaged
    ? path.join(process.resourcesPath, 'mods', PRESENCE_MOD_FILE)
    : path.join(__dirname, 'assets', 'mods', PRESENCE_MOD_FILE);
  if (!fs.existsSync(presenceSource)) throw new Error('Не найден встроенный мод отметки MaoLauncher. Переустановите комплект лаунчера.');
  fs.copyFileSync(presenceSource, path.join(dir, PRESENCE_MOD_FILE));
  files.push(PRESENCE_MOD_FILE);
  return { mods, files };
}
async function installFabricProfile() {
  const loaders = await api(`https://meta.fabricmc.net/v2/versions/loader/${GAME_VERSION}`);
  const loader = loaders.find(item => item.loader?.stable) || loaders[0];
  if (!loader) throw new Error(`Fabric для Minecraft ${GAME_VERSION} пока не опубликован.`);
  const profile = await api(`https://meta.fabricmc.net/v2/versions/loader/${GAME_VERSION}/${loader.loader.version}/profile/json`);
  const versionDir = path.join(gameRoot, 'versions', profile.id);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return { profile, loader: loader.loader.version };
}
async function runMinecraft() {
  const settings = readSettings();
  const selected = settings.profiles.find(profile => profile.name === settings.activeProfile);
  if (!selected) throw new Error('Создайте или выберите офлайн-профиль.');
  if (installPromise) return installPromise;
  installPromise = (async () => {
    emit('install:progress', { stage: 'fabric', current: 0, total: 1, label: 'Подготовка Fabric' });
    const { profile, loader } = await installFabricProfile();
    let previous = {}; try { previous = JSON.parse(settings.installManifest); } catch {}
    const { mods: modVersions, files: modFiles } = await installMods(previous.files || []);
    const baseManifest = await api('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const gameEntry = baseManifest.versions.find(item => item.id === GAME_VERSION);
    if (!gameEntry) throw new Error(`Minecraft ${GAME_VERSION} отсутствует в официальном манифесте.`);
    const baseJson = await api(gameEntry.url);
    const baseJsonPath = path.join(gameRoot, 'versions', `${GAME_VERSION}.json`);
    fs.mkdirSync(path.dirname(baseJsonPath), { recursive: true });
    fs.writeFileSync(baseJsonPath, JSON.stringify(baseJson));
    const clientJar = path.join(gameRoot, 'versions', profile.id, `${profile.id}.jar`);
    emit('install:progress', { stage: 'minecraft', current: 0, total: 1, label: 'Загрузка Minecraft 26.2' });
    await downloadFile(baseJson.downloads.client.url, clientJar, baseJson.downloads.client.sha1);
    emit('install:progress', { stage: 'minecraft', current: 0, total: 1, label: 'Загрузка Minecraft и библиотек' });
    const launcher = new Client();
    launcher.on('progress', progress => emit('install:progress', { stage: progress.type || 'minecraft', current: progress.task || 0, total: progress.total || 0, label: 'Загрузка игровых файлов' }));
    launcher.on('debug', line => { if (/failed|error/i.test(line)) emit('game:log', String(line).slice(-300)); });
    launcher.on('close', code => emit('game:closed', { code }));
    const javaPath = await ensureJava();
    const token = selected.uuid.replaceAll('-', '');
    const auth = { access_token: token, client_token: token, uuid: token, name: selected.name, user_properties: '{}', meta: { type: 'legacy' } };
    const process = await launcher.launch({
      authorization: auth, root: gameRoot, cache: path.join(gameRoot, 'cache'),
      version: { number: GAME_VERSION, type: 'release', custom: profile.id },
      memory: { max: `${settings.memory}M`, min: '1024M' },
      javaPath,
      overrides: { versionJson: baseJsonPath, detached: true },
      quickPlay: { type: 'legacy', identifier: SERVER }
    });
    if (!process) throw new Error('Не удалось запустить игру. Проверьте Java 25 и журнал лаунчера.');
    saveSettings({ ...settings, installManifest: JSON.stringify({ game: GAME_VERSION, loader, profile: profile.id, mods: modVersions.map(mod => `${mod.id}:${mod.version.id}`), files: modFiles }) });
    emit('game:started', { pid: process.pid, profile: selected.name });
    return { started: true, pid: process.pid, loader, modCount: modVersions.length };
  })();
  try { return await installPromise; } finally { installPromise = null; }
}
async function createWindow() {
  mainWindow = new BrowserWindow({ width: 1280, height: 820, minWidth: 760, minHeight: 620, title: 'MaoLauncher', icon: path.join(__dirname, 'assets', 'mao-icon.png'), backgroundColor: '#100e16', frame: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.on('minimize', event => { event.preventDefault(); mainWindow.hide(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
}
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'mao-icon.ico'));
  tray.setToolTip('MaoLauncher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть MaoLauncher', click: showWindow },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}
app.whenReady().then(async () => {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  gameRoot = path.join(app.getPath('userData'), 'game');
  ipcMain.handle('settings:read', () => readSettings());
  ipcMain.handle('settings:save', (_event, value) => saveSettings(value));
  ipcMain.handle('profiles:add', (_event, nameValue) => {
    const name = String(nameValue || '').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Ник должен содержать 3–16 символов: латиница, цифры или _.');
    const settings = readSettings();
    if (!settings.profiles.some(profile => profile.name.toLowerCase() === name.toLowerCase())) settings.profiles.push({ name, uuid: profileUuid(name), type: 'offline' });
    settings.activeProfile = name;
    return saveSettings(settings);
  });
  ipcMain.handle('profiles:select', (_event, name) => {
    const settings = readSettings();
    if (!settings.profiles.some(profile => profile.name === name)) throw new Error('Профиль не найден.');
    settings.activeProfile = name;
    return saveSettings(settings);
  });
  ipcMain.handle('profiles:delete', (_event, name) => {
    const settings = readSettings();
    const index = settings.profiles.findIndex(profile => profile.name === name);
    if (index < 0) throw new Error('Профиль не найден.');
    settings.profiles.splice(index, 1);
    if (settings.activeProfile === name) settings.activeProfile = settings.profiles[0]?.name || '';
    return saveSettings(settings);
  });
  ipcMain.handle('game:state', () => { const settings = readSettings(); let manifest = {}; try { manifest = JSON.parse(settings.installManifest); } catch {} const versionPath = manifest.profile && path.join(gameRoot, 'versions', manifest.profile, `${manifest.profile}.json`); const installed = Boolean(versionPath && fs.existsSync(versionPath) && fs.existsSync(path.join(gameRoot, 'versions', `${GAME_VERSION}.json`)) && Array.isArray(manifest.files) && manifest.files.length >= PROJECTS.length && manifest.files.every(file => fs.existsSync(path.join(gameRoot, 'mods', file)))); return { installed, root: gameRoot, busy: Boolean(installPromise) }; });
  ipcMain.handle('game:install', () => runMinecraft());
  ipcMain.handle('game:open-folder', () => { fs.mkdirSync(gameRoot, { recursive: true }); return shell.openPath(gameRoot); });
  ipcMain.handle('update:check', async () => {
    const settings = readSettings();
    const installed = await resolveMods();
    let current = []; try { current = JSON.parse(settings.installManifest).mods || []; } catch {}
    const updates = installed.filter(mod => current.length && !current.includes(`${mod.id}:${mod.version.id}`)).map(mod => mod.label);
    return { launcherVersion: LAUNCHER_VERSION, gameUpdate: false, modUpdates: updates, launcherUpdate: false, gameVersion: GAME_VERSION, launcherUpdatesAvailable: false, updateFeedConfigured: false, loaderManifest: settings.installManifest };
  });
  ipcMain.handle('server:status', () => serverStatus());
  ipcMain.handle('window:action', (_event, action) => {
    if (!mainWindow) return false;
    if (action === 'minimize') mainWindow.hide();
    else if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    else if (action === 'close') { quitting = true; mainWindow.close(); }
    return true;
  });
  createTray();
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

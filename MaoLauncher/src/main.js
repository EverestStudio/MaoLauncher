const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const dns = require('node:dns/promises');
const { performance } = require('node:perf_hooks');
const { Client } = require('minecraft-launcher-core');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const GAME_VERSION = '26.2';
const SERVER = 'mc.maopickme.ru';
const STATUS_HOST = '135.181.126.154';
const STATUS_PORT = 25737;
const STATUS_ADDRESS = `${STATUS_HOST}:${STATUS_PORT}`;
const NEWS_FEED_URL = 'https://hm572194.webhm.cloud/api/news.php';
const LAUNCHER_VERSION = app.getVersion();
const PROJECTS = [
  ['fabric-api', 'Fabric API'], ['modmenu', 'Mod Menu'], ['emotecraft', 'EmoteCraft'],
  ['simple-voice-chat', 'Simple Voice Chat'],
  ['entity-model-features', 'Entity Model Features'], ['entitytexturefeatures', 'Entity Texture Features'],
  ['player-animation-library', 'Player Animation Library'], ['sodium', 'Sodium'], ['iris', 'Iris'],
  ['litematica', 'Litematica'], ['journeymap', 'JourneyMap']
];
const DEFAULTS = { memory: 4096, theme: 'auto', language: 'ru', minimizeBehavior: 'tray', snowfall: true, profiles: [], activeProfile: '', installManifest: '' };
let mainWindow;
let localServer;
let localServerPort;
let tray;
let quitting = false;
let settingsPath;
let gameRoot;
let installPromise;
let newsCache = [];
let newsCacheAt = 0;
let newsRequest = null;

function readSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(value) {
  const clean = { ...DEFAULTS, ...value };
  clean.memory = Math.max(2048, Math.min(32768, Number(clean.memory) || 4096));
  clean.theme = ['auto', 'light', 'dark'].includes(clean.theme) ? clean.theme : 'auto';
  clean.language = ['ru', 'en'].includes(clean.language) ? clean.language : 'ru';
  clean.minimizeBehavior = ['tray', 'taskbar'].includes(clean.minimizeBehavior) ? clean.minimizeBehavior : 'tray';
  clean.snowfall = clean.snowfall !== false;
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

async function fetchServerNews() {
  if (newsCacheAt && Date.now() - newsCacheAt < 10 * 60 * 1000) return { news: newsCache };
  if (newsRequest) return newsRequest;
  newsRequest = (async () => {
    try {
      const response = await fetch(NEWS_FEED_URL, { headers: { 'Accept': 'application/json', 'User-Agent': 'MaoLauncher/' + LAUNCHER_VERSION }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Источник новостей вернул HTTP ' + response.status + '.');
      const payload = await response.json();
      if (!payload || payload.ok !== true || !Array.isArray(payload.news)) throw new Error('Источник новостей вернул неверный формат.');
      const clean = payload.news.filter(item => item && typeof item.title === 'string' && typeof item.text === 'string')
        .slice(0, 10).map(item => ({
          title: item.title.slice(0, 160),
          text: item.text.slice(0, 1200),
          date: typeof item.date === 'string' ? item.date.slice(0, 32) : '',
          tag: 'ВК · СООБЩЕСТВО',
          image: typeof item.image === 'string' && item.image.startsWith('https://') ? item.image : '',
          url: typeof item.url === 'string' && /^https:\/\/(vk\.ru|vk\.com)\//i.test(item.url) ? item.url : ''
        }));
      newsCache = clean;
      newsCacheAt = Date.now();
      return { news: newsCache };
    } catch (error) {
      if (newsCache.length) return { news: newsCache, stale: true };
      throw error;
    } finally { newsRequest = null; }
  })();
  return newsRequest;
}

function emit(channel, data) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data); }
const DISCORD_CLIENT_ID = '1571975710409629776';
let discordClient = null;
let discordReconnectTimer = null;
let discordGameStartedAt = null;

function updateDiscordPresence() {
  const user = discordClient?.user;
  if (!user) return;
  const activity = discordGameStartedAt
    ? {
        details: `Играет в Minecraft ${GAME_VERSION}`,
        state: 'Запущено через MaoLauncher',
        startTimestamp: discordGameStartedAt,
        instance: false
      }
    : {
        details: 'В лаунчере MaoLauncher',
        state: 'Готов к игре',
        instance: false
      };
  Promise.resolve(user.setActivity(activity)).catch(() => {});
}

function scheduleDiscordReconnect() {
  if (quitting || discordReconnectTimer) return;
  discordReconnectTimer = setTimeout(() => {
    discordReconnectTimer = null;
    connectDiscordPresence();
  }, 15000);
  discordReconnectTimer.unref?.();
}

async function connectDiscordPresence() {
  if (quitting || discordClient) return;
  let client;
  try {
    const { Client: DiscordClient } = require('@xhayper/discord-rpc');
    client = new DiscordClient({ clientId: DISCORD_CLIENT_ID });
    discordClient = client;
    client.on('ready', updateDiscordPresence);
    client.on('disconnected', () => {
      if (discordClient !== client) return;
      discordClient = null;
      scheduleDiscordReconnect();
    });
    client.on('error', () => {
      if (discordClient !== client) return;
      discordClient = null;
      try { client.destroy(); } catch {}
      scheduleDiscordReconnect();
    });
    await client.login();
  } catch {
    if (!client || discordClient === client) discordClient = null;
    try { client?.destroy(); } catch {}
    scheduleDiscordReconnect();
  }
}

function setDiscordGameState(running) {
  discordGameStartedAt = running ? new Date() : null;
  updateDiscordPresence();
}
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
  const host = STATUS_HOST, port = STATUS_PORT;
  const addressBytes = Buffer.from(host, 'utf8');
  const handshakeData = Buffer.concat([varInt(767), varInt(addressBytes.length), addressBytes, Buffer.from([port >> 8, port & 255]), varInt(1)]);
  const handshake = Buffer.concat([varInt(handshakeData.length + 1), Buffer.from([0]), handshakeData]);
  const packet = Buffer.concat([handshake, Buffer.from([1, 0])]);
  const started = performance.now();
  const response = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = []; let total = 0;
    const timer = setTimeout(() => socket.destroy(new Error('Тайм-аут ответа сервера.')), 4000);
    socket.on('connect', () => socket.write(packet));
    socket.on('data', chunk => {
      chunks.push(chunk); total += chunk.length;
      try {
        const data = Buffer.concat(chunks, total);
        const length = readVarInt(data);
        const pid = readVarInt(data, length.next);
        if (pid.value !== 0) throw new Error('Сервер прислал неизвестный пакет.');
        const jsonLength = readVarInt(data, pid.next);
        if (data.length >= jsonLength.next + jsonLength.value) {
          clearTimeout(timer); socket.end();
          resolve(JSON.parse(data.subarray(jsonLength.next, jsonLength.next + jsonLength.value).toString('utf8')));
        }
      } catch (error) {
        if (error instanceof SyntaxError || /неизвестный пакет/.test(error.message)) {
          clearTimeout(timer); socket.destroy(); reject(error);
        }
      }
    });
    socket.on('error', error => { clearTimeout(timer); reject(error); });
  });
  return { online: true, players: response.players || {}, version: response.version?.name || GAME_VERSION, ping: Math.round(performance.now() - started), sample: response.players?.sample || [], motd: response.description?.text || '' };
}
async function measureServerPing() {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const socket = net.createConnection({ host: STATUS_HOST, port: STATUS_PORT });
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
    const initial = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!initial.ok) throw new Error(`Minecraft-Hosting вернул HTTP ${initial.status}.`);
    const html = await initial.text();
    const token = html.match(/name="_token" value="([^"]+)"/)?.[1];
    if (!token) throw new Error('Не удалось прочитать форму статуса Minecraft-Hosting.');
    const cookies = initial.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies, origin: 'https://minecraft-hosting.net', referer: url },
      body: new URLSearchParams({ _token: token, server_type: 'java', server_address: STATUS_ADDRESS }),
      signal: AbortSignal.timeout(8000)
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
      if (!/server-status-card server-offline/.test(result)) throw new Error('Формат ответа Minecraft-Hosting изменился.');
    }
    const value = {
      online,
      players: { online: Number.isFinite(playersOnline) ? playersOnline : 0, max: Number.isFinite(playersMax) ? playersMax : 0 },
      version: field('Версия') || GAME_VERSION,
      ping: null, sample: [], motd: '', source: 'minecraft-hosting.net'
    };
    hostedStatusCache = value;
    hostedStatusUpdatedAt = Date.now();
    return value;
  })();
  try { return await hostedStatusPromise; } finally { hostedStatusPromise = null; }
}
async function publicServerStats() {
  const response = await fetch('https://api.mcsrvstat.us/3/' + encodeURIComponent(STATUS_ADDRESS), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Сервис статистики вернул HTTP ' + response.status + '.');
  const data = await response.json();
  if (typeof data.online !== 'boolean') throw new Error('Сервис статистики вернул неполные данные.');
  const onlineCount = Number(data.players?.online);
  const maxCount = Number(data.players?.max);
  const sample = Array.isArray(data.players?.list) ? data.players.list.map(player => typeof player === 'string' ? { name: player } : player).filter(player => player?.name) : [];
  return {
    online: data.online,
    players: { online: Number.isFinite(onlineCount) ? onlineCount : 0, max: Number.isFinite(maxCount) ? maxCount : 0, sample },
    version: data.version || GAME_VERSION,
    ping: Number.isFinite(data.debug?.ping) ? data.debug.ping : null,
    sample, motd: (data.motd?.clean || data.motd?.raw || []).join?.(' ') || '',
    source: 'mcsrvstat.us'
  };
}
async function serverStatus() {
  const [publicStats, direct, hosted, ping] = await Promise.allSettled([publicServerStats(), directServerStatus(), hostedServerStatus(), measureServerPing()]);
  if (publicStats.status === 'fulfilled') return { ...publicStats.value, ping: ping.status === 'fulfilled' ? ping.value : publicStats.value.ping };
  if (direct.status === 'fulfilled') return { ...direct.value, ping: ping.status === 'fulfilled' ? ping.value : direct.value.ping };
  if (hosted.status === 'fulfilled') return { ...hosted.value, ping: ping.status === 'fulfilled' ? ping.value : null };
  throw new Error(publicStats.reason?.message || direct.reason?.message || hosted.reason?.message || 'Сервер недоступен.');
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
    launcher.on('close', code => { setDiscordGameState(false); emit('game:closed', { code }); });
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
    setDiscordGameState(true);
    emit('game:started', { pid: process.pid, profile: selected.name });
    return { started: true, pid: process.pid, loader, modCount: modVersions.length };
  })();
  try { return await installPromise; } finally { installPromise = null; }
}
async function startLocalWebServer() {
  if (localServerPort) return localServerPort;
  const http = require('node:http');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
  localServer = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); } catch { response.writeHead(400).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(__dirname, relative);
    if (file !== __dirname && !file.startsWith(__dirname + path.sep)) { response.writeHead(403).end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404).end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(file).pipe(response);
    });
  });
  await new Promise((resolve, reject) => { localServer.once('error', reject); localServer.listen(0, '127.0.0.1', resolve); });
  localServerPort = localServer.address().port;
  return localServerPort;
}
async function createWindow() {
  const port = await startLocalWebServer();
  mainWindow = new BrowserWindow({ width: 1120, height: 820, minWidth: 1120, maxWidth: 1280, minHeight: 820, maxHeight: 820, resizable: false, maximizable: false, title: 'MaoLauncher', icon: path.join(__dirname, 'assets', 'mao-icon.png'), backgroundColor: '#100e16', frame: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  await mainWindow.loadURL('http://127.0.0.1:' + port + '/');
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

const RELEASE_API = 'https://api.github.com/repos/EverestStudio/MaoLauncher/releases/latest';
function compareVersions(left, right) {
  const a = String(left).replace(/^v/i, '').split('.').map(Number), b = String(right).replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const diff = (a[i] || 0) - (b[i] || 0); if (diff) return Math.sign(diff); }
  return 0;
}
async function latestLauncherRelease() {
  const release = await api(RELEASE_API), version = String(release.tag_name || '').replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('У последнего релиза некорректный номер версии.');
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const archive = assets.find(item => /^MaoLauncher-.*-win-x64\.zip$/i.test(item.name || ''));
  if (!archive) throw new Error('В последнем релизе не найден ZIP-архив Windows x64.');
  const checksum = assets.find(item => item.name === archive.name + '.sha256');
  if (!checksum) throw new Error('В последнем релизе отсутствует SHA-256 для архива.');
  return { version, archiveUrl: archive.browser_download_url, checksumUrl: checksum.browser_download_url, archiveName: archive.name };
}
async function checkLauncherUpdate() {
  const release = await latestLauncherRelease();
  return { currentVersion: LAUNCHER_VERSION, latestVersion: release.version, available: compareVersions(release.version, LAUNCHER_VERSION) > 0 };
}
function findLauncherExecutable(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === 'maolauncher.exe') return full;
    if (entry.isDirectory()) { const found = findLauncherExecutable(full); if (found) return found; }
  }
  return null;
}
function psQuote(value) { return "'" + String(value).replaceAll("'", "''") + "'"; }
async function installLauncherUpdate() {
  if (process.platform !== 'win32' || !app.isPackaged) throw new Error('Обновление лаунчера доступно в установленной Windows-версии.');
  if (installPromise) throw new Error('Дождитесь завершения установки Minecraft.');
  const release = await latestLauncherRelease();
  if (compareVersions(release.version, LAUNCHER_VERSION) <= 0) return { upToDate: true };
  if (!release.archiveUrl?.startsWith('https://') || !release.checksumUrl?.startsWith('https://')) throw new Error('GitHub вернул небезопасную ссылку обновления.');
  const work = fs.mkdtempSync(path.join(app.getPath('temp'), 'MaoLauncher-update-'));
  try {
    const zipPath = path.join(work, release.archiveName);
    const response = await fetch(release.archiveUrl);
    if (!response.ok) throw new Error('Не удалось скачать обновление: HTTP ' + response.status);
    const chunks = [];
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      received += value.length;
      const percent = total ? Math.min(65, Math.round(received / total * 65)) : 20;
      emit('launcher-update:progress', { current: percent, label: 'Скачиваем MaoLauncher ' + release.version });
    }
    const data = Buffer.concat(chunks);
    fs.writeFileSync(zipPath, data);
    emit('launcher-update:progress', { current: 70, label: 'Проверяем целостность обновления' });
    const checksumResponse = await fetch(release.checksumUrl);
    if (!checksumResponse.ok) throw new Error('Не удалось скачать контрольную сумму обновления.');
    const checksumText = await checksumResponse.text();
    const expected = checksumText.match(/\b[0-9a-f]{64}\b/i)?.[0];
    if (!expected) throw new Error('Файл SHA-256 имеет неверный формат.');
    const actual = crypto.createHash('sha256').update(data).digest('hex');
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('Контрольная сумма обновления не совпала. Установка отменена.');
    emit('launcher-update:progress', { current: 82, label: 'Распаковываем обновление' });
    const extracted = path.join(work, 'extracted'); fs.mkdirSync(extracted);
    const AdmZip = require('adm-zip'); new AdmZip(zipPath).extractAllTo(extracted, true);
    const executable = findLauncherExecutable(extracted);
    if (!executable) throw new Error('В архиве обновления не найден MaoLauncher.exe.');
    const staged = path.join(work, 'staged-app'); fs.cpSync(path.dirname(executable), staged, { recursive: true });
    const installRoot = path.dirname(process.execPath), backup = installRoot + '.update-backup', script = path.join(work, 'apply-update.ps1'), log = path.join(app.getPath('userData'), 'update-install.log');
    const scriptText = [
      "$ErrorActionPreference = 'Stop'",
      "Start-Transcript -Path " + psQuote(log) + " -Append | Out-Null",
      '$launcherProcessId = ' + process.pid,
      '$install = ' + psQuote(installRoot),
      '$staged = ' + psQuote(staged),
      '$backup = ' + psQuote(backup),
      'try {',
      '  while (Get-Process -Id $launcherProcessId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }',
      '  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }',
      '  if (Test-Path -LiteralPath $install) { Move-Item -LiteralPath $install -Destination $backup }',
      '  Move-Item -LiteralPath $staged -Destination $install',
      "  Start-Process -FilePath (Join-Path $install 'MaoLauncher.exe')",
      '} catch {',
      '  Write-Error $_',
      '  if (!(Test-Path -LiteralPath $install) -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $install }',
      '  Start-Sleep -Seconds 8',
      '} finally { Stop-Transcript | Out-Null }',
      'Start-Sleep -Seconds 2',
      'Remove-Item -LiteralPath ' + psQuote(work) + ' -Recurse -Force -ErrorAction SilentlyContinue'
    ].join('\r\n');
    fs.writeFileSync(script, scriptText, 'utf8');
    emit('launcher-update:progress', { current: 95, label: 'Перезапускаем MaoLauncher' });
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', error => { try { fs.appendFileSync(log, '\\nUpdater launch error: ' + error.message); } catch {} });
    child.unref();
    await new Promise(resolve => setTimeout(resolve, 700));
    app.quit(); return { started: true, version: release.version };
  } catch (error) { fs.rmSync(work, { recursive: true, force: true }); throw error; }
}

const TWITCH_CHANNELS = ['niriska', 'similar_cav', 'tomskiybtw'];
async function fetchTwitchText(endpoint, channel) {
  const response = await fetch(`https://decapi.me/twitch/${endpoint}/${encodeURIComponent(channel)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Twitch API HTTP ${response.status}`);
  return (await response.text()).trim();
}
async function fetchTwitchStreams() {
  return Promise.all(TWITCH_CHANNELS.map(async name => {
    try {
      const uptime = await fetchTwitchText('uptime', name);
      if (!uptime) throw new Error('Empty Twitch API response');
      if (/\[error|error occurred|unable to|not found|invalid|channel name required/i.test(uptime)) throw new Error(uptime);
      const live = !/offline|not currently live|no live stream|is not live/i.test(uptime);
      let title = '', category = '', viewers = null;
      if (live) {
        const [titleResult, categoryResult, viewersResult] = await Promise.allSettled([
          fetchTwitchText('title', name), fetchTwitchText('game', name), fetchTwitchText('viewercount', name)
        ]);
        if (titleResult.status === 'fulfilled') title = titleResult.value;
        if (categoryResult.status === 'fulfilled') category = categoryResult.value;
        if (viewersResult.status === 'fulfilled' && /^\d+$/.test(viewersResult.value)) viewers = Number(viewersResult.value);
      }
      return { name, live, uptime: live ? uptime : '', title, category, viewers, unavailable: false };
    } catch (error) {
      return { name, live: false, uptime: '', title: '', category: '', viewers: null, unavailable: true, error: String(error?.message || error) };
    }
  }));
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
    const [installed, launcher] = await Promise.all([resolveMods().catch(() => []), checkLauncherUpdate()]);
    let current = []; try { current = JSON.parse(settings.installManifest).mods || []; } catch {}
    const updates = installed.filter(mod => current.length && !current.includes(`${mod.id}:${mod.version.id}`)).map(mod => mod.label);
    return { launcherVersion: LAUNCHER_VERSION, latestLauncherVersion: launcher.latestVersion, launcherUpdate: launcher.available, gameUpdate: false, modUpdates: updates, gameVersion: GAME_VERSION, launcherUpdatesAvailable: launcher.available, updateFeedConfigured: true, loaderManifest: settings.installManifest };
  });
  ipcMain.handle('launcher:update-install', () => installLauncherUpdate());
  ipcMain.handle('news:get', () => fetchServerNews());
  ipcMain.handle('launcher:version', () => LAUNCHER_VERSION);
  ipcMain.handle('server:status', () => serverStatus());
  ipcMain.handle('twitch:status', () => fetchTwitchStreams());
  ipcMain.handle('window:sidebar-expanded', (_event, expanded) => { if (!mainWindow || mainWindow.isDestroyed()) return false; mainWindow.setSize(expanded ? 1280 : 1120, 820, true); return true; });
  ipcMain.handle('window:action', (_event, action) => {
    if (!mainWindow) return false;
    if (action === 'minimize') {
      if (readSettings().minimizeBehavior === 'tray') mainWindow.hide();
      else mainWindow.minimize();
    }
    else if (action === 'close') { quitting = true; mainWindow.close(); }
    return true;
  });
  createTray();
  await createWindow();
  connectDiscordPresence();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => {
  quitting = true;
  if (discordReconnectTimer) clearTimeout(discordReconnectTimer);
  discordReconnectTimer = null;
  try { discordClient?.user?.clearActivity(); } catch {}
  try { discordClient?.destroy(); } catch {}
  discordClient = null;
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

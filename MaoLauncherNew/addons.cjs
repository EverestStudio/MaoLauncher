const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const API = 'https://api.modrinth.com/v2';
const GAME_VERSION = '26.2';
const TYPES = new Set(['mod', 'resourcepack', 'shader']);
const TARGETS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };

async function requestJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'MaoLauncher/1.0 (https://github.com/EverestStudio/MaoLauncher)' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Каталог дополнений временно недоступен (' + response.status + ')');
  return response.json();
}

async function searchAddons(type, query = '') {
  if (!TYPES.has(type)) throw new Error('Эта категория пока не поддерживает каталог установки');
  const params = new URLSearchParams({ query: String(query).slice(0, 100), limit: '24', index: 'relevance' });
  params.set('facets', JSON.stringify([[ 'project_type:' + (type === 'mod' ? 'mod' : type === 'resourcepack' ? 'resourcepack' : 'shader') ]]));
  const data = await requestJson(API + '/search?' + params);
  return (data.hits || []).map(hit => ({
    id: hit.project_id,
    title: hit.title,
    description: hit.description,
    icon: hit.icon_url || '',
    downloads: hit.downloads || 0,
    author: hit.author || '',
    slug: hit.slug
  }));
}

async function installAddon(root, type, projectId, emit = () => {}) {
  if (!TYPES.has(type) || typeof projectId !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) throw new Error('Некорректное дополнение');
  const params = new URLSearchParams({ game_versions: JSON.stringify([GAME_VERSION]) });
  if (type === 'mod') params.set('loaders', JSON.stringify(['fabric']));
  const versions = await requestJson(API + '/project/' + encodeURIComponent(projectId) + '/version?' + params);
  const version = versions.find(v => Array.isArray(v.files) && v.files.some(f => f.primary)) || versions.find(v => Array.isArray(v.files) && v.files.length);
  if (!version) throw new Error('Совместимая версия для Minecraft ' + GAME_VERSION + ' не найдена');
  const file = version.files.find(f => f.primary) || version.files[0];
  const url = new URL(file.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.modrinth.com') throw new Error('Недопустимый адрес файла');
  const filename = path.basename(file.filename || url.pathname);
  if (!filename || filename !== file.filename || !/^[\w .()+-]+\.(jar|zip)$/i.test(filename)) throw new Error('Некорректное имя файла');
  emit({ stage: 'Загрузка ' + filename, percent: 0 });
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Не удалось скачать файл (' + response.status + ')');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 350 * 1024 * 1024) throw new Error('Недопустимый размер файла');
  if (file.hashes?.sha512) {
    const digest = crypto.createHash('sha512').update(bytes).digest('hex');
    if (digest.toLowerCase() !== file.hashes.sha512.toLowerCase()) throw new Error('Контрольная сумма файла не совпала');
  }
  const folder = path.join(root, TARGETS[type]);
  await fs.mkdir(folder, { recursive: true });
  const target = path.join(folder, filename);
  const temp = target + '.mao-tmp';
  await fs.writeFile(temp, bytes, { flag: 'w' });
  await fs.rename(temp, target);
  emit({ stage: 'Установлено: ' + filename, percent: 100 });
  return { filename, version: version.version_number, folder: TARGETS[type] };
}

module.exports = { searchAddons, installAddon };

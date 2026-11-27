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

async function searchAddons(type, query = '', page = 1) {
  if (!TYPES.has(type)) throw new Error('Эта категория пока не поддерживает каталог установки');
  const pageSize=24;page=Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1;
  const params = new URLSearchParams({ query: String(query).slice(0, 100), limit: String(pageSize), offset: String((page-1)*pageSize), index: 'relevance' });
  params.set('facets', JSON.stringify([[ 'project_type:' + (type === 'mod' ? 'mod' : type === 'resourcepack' ? 'resourcepack' : 'shader') ]]));
  const filters=[['project_type:'+type],['versions:'+GAME_VERSION]];if(type==='mod')filters.push(['categories:fabric']);params.set('facets',JSON.stringify(filters));
  const data = await requestJson(API + '/search?' + params);
  const items = (data.hits || []).map(hit => ({
    id: hit.project_id,
    title: hit.title,
    description: hit.description,
    icon: hit.icon_url || '',
    downloads: hit.downloads || 0,
    author: hit.author || '',
    slug: hit.slug
  }));
  return {items,total:Number.isSafeInteger(data.total_hits)?data.total_hits:items.length,page,pageSize};
}

async function installAddon(root, type, projectId, emit = () => {}, visited = new Set(), versionId = null) {
 if(visited.has(projectId))return;visited.add(projectId);
  if (!TYPES.has(type) || typeof projectId !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) throw new Error('Некорректное дополнение');
  const params = new URLSearchParams({ game_versions: JSON.stringify([GAME_VERSION]) });
  if (type === 'mod') params.set('loaders', JSON.stringify(['fabric']));
  const versions = versionId?[await requestJson(API+'/version/'+encodeURIComponent(versionId))]:await requestJson(API + '/project/' + encodeURIComponent(projectId) + '/version?' + params);
  const version = versions.find(v => Array.isArray(v.files) && v.files.some(f => f.primary)) || versions.find(v => Array.isArray(v.files) && v.files.length);
  if (!version) throw new Error('Совместимая версия для Minecraft ' + GAME_VERSION + ' не найдена');
  if(!version.game_versions.includes(GAME_VERSION)||(type==='mod'&&!version.loaders.includes('fabric')))throw Error('Несовместимая версия дополнения');
  if(type==='mod')for(const d of version.dependencies||[])if(d.dependency_type==='required'&&d.project_id)await installAddon(root,'mod',d.project_id,emit,visited,d.version_id);
  const file = version.files.find(f => f.primary) || version.files[0];
  const url = new URL(file.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.modrinth.com') throw new Error('Недопустимый адрес файла');
  const filename = path.basename(file.filename || url.pathname);
  if (!filename || filename !== file.filename || /[<>:"/\\|?*\x00-\x1f]/.test(filename) || !/\.(jar|zip)$/i.test(filename)) throw new Error('Некорректное имя файла');
  const installed=await listInstalled(root),key=type+':'+projectId;
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
  const previous=installed[key];installed[key]={type,projectId,filename,title:version.name||filename,version:version.version_number,folder:TARGETS[type]};await saveInstalled(root,installed);if(previous&&previous.filename!==filename&&safeFile(previous.filename))await fs.rm(path.join(folder,previous.filename),{force:true});return installed[key];
}

const stateFile=root=>path.join(root,'.mao-addons.json');
const safeFile=name=>typeof name==='string'&&name===path.basename(name)&&!/[<>:"/\\|?*\x00-\x1f]/.test(name)&&/\.(jar|zip)$/i.test(name);
async function listInstalled(root){let state;try{state=JSON.parse(await fs.readFile(stateFile(root),'utf8'))}catch(e){if(e.code==='ENOENT')return {};throw e}const result={};for(const [key,item] of Object.entries(state)){if(!item||!TYPES.has(item.type)||!safeFile(item.filename)||key!==item.type+':'+item.projectId)continue;try{await fs.access(path.join(root,TARGETS[item.type],item.filename));result[key]=item}catch(e){if(e.code!=='ENOENT')throw e}}return result}
async function saveInstalled(root,state){await fs.mkdir(root,{recursive:true});await fs.writeFile(stateFile(root)+'.tmp',JSON.stringify(state,null,2));await fs.rename(stateFile(root)+'.tmp',stateFile(root))}
async function removeAddon(root,type,id){if(!TYPES.has(type)||typeof id!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(id))throw Error('Некорректное дополнение');const state=await listInstalled(root),key=type+':'+id,item=state[key];if(!item)return;const base=require('./mods-manifest.json').mods;if(type==='mod'&&base.some(m=>m.file===item.filename))throw Error('Этот мод входит в основной набор лаунчера');await fs.rm(path.join(root,TARGETS[type],item.filename),{force:true});delete state[key];await saveInstalled(root,state)}
module.exports={searchAddons,installAddon,listInstalled,removeAddon};

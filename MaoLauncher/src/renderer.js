const defaults = { memory: 4096, theme: 'auto', language: 'ru', minimizeBehavior: 'tray', profiles: [], activeProfile: '', news: [] };
let config = { ...defaults }, gameInstalled = false, gameBusy = false, gameUpdateAvailable = false, launcherUpdateAvailable = false, toastTimer;
const byId = (id) => document.getElementById(id);
function configureNavigation() {
  const profileButton = document.querySelector('.nav button[data-view="profileview"]');
  const mapButton = document.querySelector('.nav button[data-view="updatesview"]');
  const serverButton = document.querySelector('.nav button[data-view="serverview"]');
  const aboutButton = document.querySelector('.nav button[data-view="aboutview"]');
  const sidefoot = document.querySelector('.sidefoot');
  const settings = document.querySelector('#settingsview .settings');
  const aboutView = byId('aboutview');
  const home = byId('home');
  document.querySelectorAll('#home .address span, #serverview .address span').forEach(element => { element.textContent = 'mc.maopickme.ru'; });
  const serverHeading = document.querySelector('#serverview .sectionhead p');
  if (serverHeading) serverHeading.textContent = 'Состояние mc.maopickme.ru';
  const serverStrip = home.querySelector('.serverStrip');
  home.querySelector('.serverStrip [data-go="serverview"]')?.remove();
  for (const label of ['Пинг']) {
    const row = [...home.querySelectorAll('.sidepanel .stat')].find(item => item.querySelector('.muted')?.textContent.trim() === label);
    if (!row) continue;
    row.className = 'stripStat';
    serverStrip.append(row);
  }
  const statusButton = document.createElement('button');
  statusButton.id = 'refreshServerHome';
  statusButton.className = 'secondary';
  statusButton.type = 'button';
  statusButton.textContent = '↻ Обновить статус';
  statusButton.addEventListener('click', checkServer);
  const tpsRow = [...home.querySelectorAll('.sidepanel .stat')].find(item => item.querySelector('.muted')?.textContent.trim() === 'TPS');
  tpsRow?.replaceWith(statusButton);
  serverStrip.append(statusButton);
  serverStrip.style.gridTemplateColumns = '1.3fr repeat(3, minmax(0, 1fr)) auto';
  if (mapButton) {
    mapButton.dataset.view = 'mapview';
    mapButton.innerHTML = '<span>▧</span><span class="navText">Онлайн карта</span>';
  }
  const gameVersionLabel = serverStrip.querySelector('#gameVersion')?.parentElement?.querySelector('small');
  if (gameVersionLabel) gameVersionLabel.textContent = 'Версия сервера';
  const homeBuildHeading = [...home.querySelectorAll('.sectionhead')].find(item => item.querySelector('h2')?.textContent.trim() === 'Сборка сервера');
  homeBuildHeading?.nextElementSibling?.remove();
  homeBuildHeading?.remove();
  home.querySelector('[data-quick=top]')?.remove();
  home.querySelector('[data-quick=shop]')?.remove();
  const communityLinks = [
    [home.querySelector('[data-quick="discord"]'), 'https://t.me/+RFqx4ziQjLQzNGYy', 'Telegram-чат', '◉'],
    [home.querySelector('[data-quick="website"]'), 'https://maopickme.ru', 'Наш сайт', '↗'],
  ];
  for (const [link, href, label, icon] of communityLinks) {
    if (!link) continue;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<span class="quickIcon">${icon}</span>${label}`;
  }
  const vkLink = document.createElement('a');
  vkLink.className = 'quickLink';
  vkLink.href = 'https://vk.ru/maopickme_mc';
  vkLink.target = '_blank';
  vkLink.rel = 'noopener noreferrer';
  vkLink.innerHTML = '<span class="quickIcon">↗</span>Группа ВК';
  home.querySelector('.quickLinks')?.append(vkLink);
  const offlineIcon = document.querySelector('#offlineChoice .accountIcon');
  if (offlineIcon) offlineIcon.innerHTML = '<img alt="" src="https://mc-heads.net/avatar/Steve/42">';
  const skinPreview = byId('profileSkinPreview');
  if (skinPreview) skinPreview.style.cssText = 'width:42px;height:42px;flex:none;object-fit:cover;image-rendering:pixelated;border:1px solid var(--line);border-radius:4px';
  const profileInput = byId('profileName');
  if (profileInput) profileInput.style.cssText = 'display:block;visibility:visible;opacity:1;flex:1;min-width:220px;height:42px;padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--text);caret-color:var(--accent2);pointer-events:auto;user-select:text;-webkit-app-region:no-drag';
  home.querySelector('.sidepanel .address')?.remove();
  home.querySelector('#copyAddress')?.remove();
  const sideStatus = byId('sideStatus');
  if (sideStatus) sideStatus.textContent = 'Состояние сервера';
  if (profileButton && sidefoot) {
    profileButton.classList.add('profileNav');
    profileButton.style.cssText = 'display:flex;width:auto;margin:0;padding:8px 13px;text-align:left;border:1px solid #9c60c2;border-radius:5px;background:#21192a;color:var(--text);font-size:13px;font-weight:650';
    const dock = document.createElement('div');
    dock.className = 'profileDock';
    dock.style.cssText = 'position:relative;width:auto;margin:0';
    const menu = document.createElement('div');
    menu.id = 'profileMenu';
    menu.className = 'profileMenu';
    menu.hidden = true;
    dock.append(menu, profileButton);
    document.querySelector('.topActions')?.append(dock);
    profileButton.setAttribute('aria-haspopup', 'true');
    profileButton.setAttribute('aria-expanded', 'false');
    profileButton.addEventListener('click', event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      profileButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => { menu.hidden = true; profileButton.setAttribute('aria-expanded', 'false'); });
  }
  serverButton?.remove();
  aboutButton?.remove();
  if (aboutView && settings) {
    const source = aboutView.querySelector('.panel');
    const title = document.createElement('strong');
    title.textContent = 'О лаунчере';
    const details = document.createElement('div');
    details.className = 'muted';
    details.style.fontSize = '11px';
    details.textContent = [...source.querySelectorAll('.muted')].map(item => item.textContent).join(' · ');
    const row = document.createElement('div');
    row.className = 'settingsRow';
    row.append(title, details);
    settings.append(row);
    aboutView.remove();
  }
}
const safe = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#39;');
function notify(message, error = false) { const toast = byId('toast'); toast.textContent = message; toast.classList.toggle('error', error); toast.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4200); }
function renderNews(news) {
  if (!news.length) return "<article class='news'><div class='newsIcon'>✦</div><div class='newsText'><span class='tag'>НОВОСТИ</span><h3>Пока нет новостей</h3><p>Новости сообщества появятся здесь после загрузки.</p></div></article>";
  return news.map(item => {
    const content = "<div class='newsIcon'>" + (item.image ? "<img alt='' src='" + safe(item.image) + "'>" : safe(item.icon || '✦')) + "</div><div class='newsText'><span class='tag'>" + safe(item.tag || 'НОВОСТЬ') + ' · ' + safe(item.date || '') + "</span><h3>" + safe(item.title) + "</h3><p>" + safe(item.text) + "</p></div>";
    return item.url && /^https:\/\/(vk\.ru|vk\.com)\//i.test(item.url)
      ? "<a class='news newsLink' href='" + safe(item.url) + "' target='_blank' rel='noopener noreferrer'>" + content + "</a>"
      : "<article class='news'>" + content + "</article>";
  }).join('');
}
async function loadNews() {
  try {
    const result = await window.launcher.getNews();
    config.news = Array.isArray(result.news) ? result.news : [];
    render();
  } catch (error) {
    if (!config.news?.length) config.news = [];
    render();
    const message = 'Не удалось загрузить новости ВК: ' + error.message;
    const home = byId('homeNews'), all = byId('allNews');
    if (!config.news.length) {
      const note = "<p class='newsLoadError'>" + safe(message) + "</p>";
      home.insertAdjacentHTML('beforeend', note);
      all.insertAdjacentHTML('beforeend', note);
    }
  }
}
function renderProfiles() {
  const active = config.profiles.find(profile => profile.name === config.activeProfile);
  const button = document.querySelector('.profileNav');
  if (button) button.innerHTML = active
    ? '<img class="profileButtonAvatar" alt="" src="https://mc-heads.net/avatar/' + encodeURIComponent(active.name) + '/32"><span class="navText">' + safe(active.name) + '</span><small class="profileType">' + (active.type === 'elyby' ? 'Ely.by' : 'Оффлайн') + '</small>'
    : '<span>♙</span><span class="navText">Профиль</span>';
  button?.querySelector('.profileButtonAvatar')?.addEventListener('error', event => { event.currentTarget.hidden = true; });
  const menu = byId('profileMenu');
  if (menu) menu.innerHTML = '<div class="profileMenuTitle">Профили</div>' + (config.profiles.length ? config.profiles.map(profile => '<div class="profileOptionRow"><button class="profileOption ' + (profile.name === config.activeProfile ? 'selected' : '') + '" data-profile="' + safe(profile.name) + '"><img class="profileAvatar" alt="" src="https://mc-heads.net/avatar/' + encodeURIComponent(profile.name) + '/32"><span class="profileAvatarFallback" hidden>' + safe(profile.name.slice(0, 1).toUpperCase()) + '</span><span class="profileOptionName">' + safe(profile.name) + '<small>' + (profile.type === 'elyby' ? 'Ely.by' : 'Оффлайн') + '</small></span><span class="profileCheck">' + (profile.name === config.activeProfile ? '✓' : '') + '</span></button><button class="profileDelete" data-delete-profile="' + safe(profile.name) + '" title="Удалить профиль ' + safe(profile.name) + '" aria-label="Удалить профиль ' + safe(profile.name) + '">×</button></div>').join('') : '<div class="profileEmpty">Созданных профилей нету</div>') + '<button class="profileAdd" id="openAddProfile">＋ Создать профиль</button>';
  if (byId('profileHint')) byId('profileHint').textContent = active ? 'Выбран: ' + active.name + ' · ' + (active.type === 'elyby' ? 'Ely.by' : 'оффлайн') : 'Добавьте профиль для запуска игры';
  menu?.querySelectorAll('[data-profile]').forEach(item => item.addEventListener('click', async () => {
    try { config = await window.launcher.selectProfile(item.dataset.profile); render(); menu.hidden = true; document.querySelector('.profileNav')?.setAttribute('aria-expanded', 'false'); }
    catch (error) { notify(error.message, true); }
  }));
  menu?.querySelectorAll('.profileAvatar').forEach(image => image.addEventListener('error', () => {
    image.hidden = true;
    const fallback = image.nextElementSibling;
    if (fallback) fallback.hidden = false;
  }));
  menu?.querySelectorAll('[data-delete-profile]').forEach(item => item.addEventListener('click', async () => {
    const name = item.dataset.deleteProfile;
    if (!window.confirm('Удалить профиль «' + name + '»? Это действие нельзя отменить.')) return;
    try {
      config = await window.launcher.deleteProfile(name);
      render();
      notify('Профиль «' + name + '» удалён.');
    } catch (error) { notify(error.message, true); }
  }));
  byId('openAddProfile')?.addEventListener('click', () => { menu.hidden = true; navigate('profileview'); showAccountChoices(); });
}
function showAccountChoices() { byId('offlineForm').hidden = true; byId('elybyNotice').hidden = true; document.querySelector('.accountChoices').hidden = false; }
function renderPlayButton() { const b = byId('playButton'); b.textContent = gameBusy ? 'Подготовка…' : (launcherUpdateAvailable || gameUpdateAvailable) ? 'Обновить' : gameInstalled ? 'Играть' : 'Установить'; b.disabled = gameBusy; }
const originalTextNodes = new WeakMap();
const englishText = {
  'МЕНЮ':'MENU','Главная':'Home','Сервер':'Server','Настройки':'Settings','Профиль':'Profile','Обновления':'Updates','О лаунчере':'About',
  'Твой путь в мир Minecraft начинается здесь!':'Your Minecraft adventure starts here!',
  'Новости сервера':'Server news','Последние объявления сообщества':'Latest community announcements','Пока нет новостей':'No news yet',
  'Сборка сервера':'Server modpack','Автоматическая установка Fabric-модов':'Automatic Fabric mod installation','Быстрый доступ':'Quick links',
  'Игроки онлайн':'Players online','Версия клиента':'Client version','Подробнее':'Details','Копировать IP':'Copy IP',
  'Добавить профиль':'Add profile','Выберите способ входа в MaoLauncher':'Choose how to sign in to MaoLauncher',
  'Оффлайн':'Offline','Создать локальный профиль по нику':'Create a local profile by username','Вход через учётную запись Ely.by':'Sign in with Ely.by',
  'Ник игрока':'Player name','Создать профиль':'Create profile','Назад к выбору':'Back to choices',
  'Оперативная память':'Memory','Максимум для Minecraft':'Maximum for Minecraft','Тема':'Theme','Светлая, тёмная или системная':'Light, dark or system',
  'Язык':'Language','Язык интерфейса':'Interface language','Файлы игры':'Game files','Папка Minecraft и модов':'Minecraft and mods folder',
  'Открыть папку':'Open folder','Проверить обновления':'Check for updates','Сворачивание лаунчера':'Minimize behavior',
  'Куда скрывать окно при нажатии «Свернуть»':'Where to send the window when minimized',
  'В системный трей':'To system tray','На панель задач':'To taskbar','Светлая':'Light','Тёмная':'Dark','Авто':'Auto',
  'Играйте. Увлекайтесь.':'Play. Explore.','Побеждайте!':'Win!'
};
function applyLanguage() {
  const english = config.language === 'en';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.nodeValue);
    const original = originalTextNodes.get(node) || '';
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = english ? (englishText[trimmed] || trimmed) : trimmed;
    node.nodeValue = original.replace(trimmed, translated);
  }
  document.documentElement.lang = english ? 'en' : 'ru';
  byId('minimizeWindow').title = english ? 'Minimize' : 'Свернуть';
  byId('maximizeWindow').title = english ? 'Maximize' : 'Развернуть';
  byId('closeWindow').title = english ? 'Close' : 'Закрыть';
}
function render() { document.title = 'MaoLauncher'; byId('homeNews').innerHTML = renderNews((config.news || []).slice(0, 3)); byId('allNews').innerHTML = renderNews(config.news || []); byId('memorySetting').value = String(config.memory); byId('memoryValue').value = (config.memory / 1024).toLocaleString(config.language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }) + (config.language === 'ru' ? ' ГБ' : ' GB'); byId('themeSetting').value = config.theme; byId('languageSetting').value = config.language; byId('minimizeBehavior').value = config.minimizeBehavior || 'tray'; document.documentElement.dataset.theme = config.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : config.theme; renderProfiles(); renderPlayButton(); }
async function refreshState() { try { gameInstalled = Boolean((await window.launcher.gameState()).installed); } catch { gameInstalled = false; } renderPlayButton(); }
function setUnavailable(message, status = 'Нет данных') { byId('serverStatus').textContent = status; byId('players').textContent = '— / —'; byId('ping').textContent = '— мс'; byId('topStatus').textContent = status.toUpperCase(); byId('topStatus').className = 'pill bad'; byId('sideStatus').textContent = 'Статистика недоступна'; byId('serverError').textContent = message || ''; byId('avatars').replaceChildren(); byId('serverStatusDetail').textContent = status; byId('playersDetail').textContent = '— / —'; byId('pingDetail').textContent = '— мс'; byId('serverVersionDetail').textContent = '—'; }
async function checkServer() {
  byId('serverStatus').textContent = 'Проверяем сервер…'; byId('serverError').textContent = '';
  try {
    const r = await window.launcher.serverStatus();
    if (!r.online) return setUnavailable(r.dnsError || r.error || 'Нет ответа', 'Не в сети');
    const count = r.players.online + ' / ' + r.players.max, ping = Number.isFinite(r.ping) ? r.ping + ' мс' : '— мс';
    byId('gameVersion').textContent = r.version || '—';
    byId('serverStatus').textContent = 'Сервер онлайн'; byId('players').textContent = count; byId('ping').textContent = ping; byId('topStatus').textContent = 'ОНЛАЙН'; byId('topStatus').className = 'pill good'; byId('sideStatus').textContent = 'Состояние сервера';
    byId('serverStatusDetail').textContent = 'Сервер онлайн'; byId('playersDetail').textContent = count; byId('pingDetail').textContent = ping; byId('serverVersionDetail').textContent = r.version || 'Неизвестно';
    const sample = r.players.sample || []; byId('avatars').innerHTML = sample.slice(0, 5).map(p => "<img class='avatar' title='" + safe(p.name) + "' alt='Скин игрока' src='https://mc-heads.net/avatar/" + encodeURIComponent(p.uuid || p.name) + "/30'>").join('') + (r.players.online > 5 ? '<span class=more>+' + (r.players.online - 5) + '</span>' : '');
  } catch (e) { setUnavailable(e.message); }
}
configureNavigation();
async function refreshTwitchNiriska() {
  const card = byId('twitchNiriska');
  const status = byId('twitchNiriskaStatus');
  const title = byId('twitchNiriskaTitle');
  if (!card || !status || !title) return;
  try {
    const response = await fetch('https://decapi.me/twitch/uptime/niriska', { cache: 'no-store' });
    if (!response.ok) throw new Error('Twitch status unavailable');
    const uptime = (await response.text()).trim();
    const live = uptime.length > 0 && !/offline|not found|error/i.test(uptime);
    card.classList.toggle('isLive', live);
    status.textContent = live ? 'В эфире · ' + uptime : 'Не в сети';
    title.textContent = '';
    if (live) {
      try {
        const titleResponse = await fetch('https://decapi.me/twitch/title/niriska', { cache: 'no-store' });
        if (titleResponse.ok) title.textContent = (await titleResponse.text()).trim();
      } catch {}
    }
  } catch {
    status.textContent = 'Статус недоступен';
    title.textContent = '';
    card.classList.remove('isLive');
  }
}
byId('twitchNiriskaAvatar')?.addEventListener('error', event => { event.currentTarget.src = 'https://static-cdn.jtvnw.net/jtv-static/404_preview-300x300.png'; });
function navigate(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id)); document.querySelectorAll('[data-view]').forEach(v => v.classList.toggle('active', v.dataset.view === id)); byId('crumb').textContent = ({ home: 'Главная', serverview: 'Сервер', newsview: 'Новости', settingsview: 'Настройки', profileview: 'Профиль', mapview: 'Онлайн карта', updatesview: 'Обновления', aboutview: 'О лаунчере' })[id] || 'Главная'; }
document.querySelectorAll('[data-view],[data-go]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'profileview') return; navigate(b.dataset.view || b.dataset.go); }));
byId('playButton').addEventListener('click', async () => { if (launcherUpdateAvailable) { gameBusy = true; renderPlayButton(); byId('progressWrap').hidden = false; byId('progressBar').style.width = '2%'; byId('progressText').textContent = 'Подготовка обновления…'; try { const result = await window.launcher.installLauncherUpdate(); if (result.upToDate) { launcherUpdateAvailable = false; gameBusy = false; renderPlayButton(); notify('Установлена последняя версия MaoLauncher.'); } } catch (error) { notify(error.message, true); gameBusy = false; renderPlayButton(); } return; } if (!config.activeProfile) { navigate('profileview'); document.querySelector('.accountChoices').hidden = true; byId('offlineForm').hidden = false; requestAnimationFrame(() => byId('profileName').focus()); notify('Введите ник, чтобы создать офлайн-профиль.', true); return; } gameBusy = true; renderPlayButton(); byId('progressWrap').hidden = false; byId('progressText').textContent = 'Подготовка Fabric 26.2…'; try { const r = await window.launcher.installGame(); gameInstalled = true; gameUpdateAvailable = false; byId('progressWrap').hidden = true; byId('progressText').textContent = ''; notify(r.started ? 'Игра запущена на mc.maopickme.ru.' : 'Игра установлена.'); } catch (e) { notify(e.message, true); await refreshState(); } finally { gameBusy = false; renderPlayButton(); } });
byId('offlineChoice').addEventListener('click', () => { document.querySelector('.accountChoices').hidden = true; byId('offlineForm').hidden = false; const field = byId('profileName'); field.disabled = false; field.readOnly = false; requestAnimationFrame(() => field.focus()); });
byId('elybyChoice').addEventListener('click', () => { document.querySelector('.accountChoices').hidden = true; byId('elybyNotice').hidden = false; });
byId('backToAccountChoices').addEventListener('click', showAccountChoices);
async function createOfflineProfile() { const name = byId('profileName').value.trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) { notify('Ник: 3–16 символов, латиница, цифры или _.', true); byId('profileName').focus(); return; } try { config = await window.launcher.addProfile(name); byId('profileName').value = ''; showAccountChoices(); renderProfiles(); notify('Офлайн-профиль создан.'); } catch (e) { notify(e.message, true); } }
byId('addProfile').addEventListener('click', createOfflineProfile);
byId('profileName').addEventListener('keydown', event => { if (event.key === 'Enter') createOfflineProfile(); });
byId('profileName').addEventListener('input', event => { const name = event.target.value.trim() || 'Steve'; const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/42'; byId('profileSkinPreview').src = avatar; const icon = document.querySelector('#offlineChoice .accountIcon'); if (icon) icon.innerHTML = '<img alt="Аватар скина ' + safe(name) + '" src="' + avatar + '">'; });
byId('reloadMap').addEventListener('click', () => { const frame = byId('serverMap'); frame.src = 'http://135.181.126.154:25602/?refresh=' + Date.now(); });
async function copyAddress() { await navigator.clipboard.writeText('mc.maopickme.ru'); notify('IP mc.maopickme.ru скопирован.'); }
['copyAddress', 'copySide', 'copyDetail'].forEach(id => byId(id)?.addEventListener('click', copyAddress)); byId('refreshServer').addEventListener('click', checkServer);
byId('memorySetting').addEventListener('input', event => { byId('memoryValue').value = (Number(event.target.value) / 1024).toLocaleString(config.language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }) + ' ГБ'; });
for (const [id, key] of [['memorySetting', 'memory'], ['themeSetting', 'theme'], ['languageSetting', 'language'], ['minimizeBehavior', 'minimizeBehavior']]) byId(id).addEventListener('change', async e => {
  config = await window.launcher.saveSettings({ ...config, [key]: key === 'memory' ? Number(e.target.value) : e.target.value });
  render();
  if (key === 'language') applyLanguage();
});
byId('openFolder').addEventListener('click', async () => { const error = await window.launcher.openGameFolder(); if (error) notify(error, true); });
async function checkUpdates(hintId = 'updateHint', silent = false) { const hint = byId(hintId); if (hint) hint.textContent = 'Проверяем обновления MaoLauncher и модов…'; try { const r = await window.launcher.checkUpdates(); launcherUpdateAvailable = Boolean(r.launcherUpdate); const versionLabel = byId('launcherVersionLabel'); if (versionLabel && r.launcherVersion) versionLabel.textContent = 'MaoLauncher v' + r.launcherVersion; gameUpdateAvailable = r.modUpdates.length > 0; renderPlayButton(); if (hint) hint.textContent = launcherUpdateAvailable ? 'Доступна новая версия MaoLauncher ' + r.latestLauncherVersion + '. Нажмите «Обновить» на главной.' : gameUpdateAvailable ? 'Доступны обновления модов: ' + r.modUpdates.join(', ') + '. Нажмите «Обновить» на главной.' : 'MaoLauncher и установленные моды обновлены до последних версий.'; if (!silent) notify(launcherUpdateAvailable ? 'Доступно обновление MaoLauncher ' + r.latestLauncherVersion + '.' : 'Проверка завершена.'); } catch (err) { if (hint) hint.textContent = err.message; if (!silent) notify(err.message, true); } }
byId('checkUpdates')?.addEventListener('click', () => checkUpdates());
byId('minimizeWindow').addEventListener('click', () => window.launcher.windowAction('minimize')); byId('maximizeWindow')?.addEventListener('click', () => window.launcher.windowAction('maximize')); byId('closeWindow').addEventListener('click', () => window.launcher.windowAction('close'));
window.launcher.onLauncherUpdateProgress(d => { byId('progressWrap').hidden = false; byId('progressBar').style.width = Math.max(2, d.current || 2) + '%'; byId('progressText').textContent = d.label || 'Обновление MaoLauncher…'; });
window.launcher.onProgress(d => { byId('progressWrap').hidden = false; const pct = d.total ? Math.max(3, Math.min(100, Math.round(d.current / d.total * 100))) : 6; byId('progressBar').style.width = pct + '%'; byId('progressText').textContent = (d.label || 'Загрузка') + (d.total ? ' · ' + d.current + '/' + d.total : ''); });
window.launcher.onGameStarted(d => notify('Minecraft запущен: ' + d.profile)); window.launcher.onGameClosed(d => { if (d.code) notify('Игра завершилась с кодом ' + d.code, true); }); window.launcher.onGameLog(line => { byId('progressText').textContent = line; });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (config.theme === 'auto') render(); });
(async () => { try { config = { ...defaults, ...(await window.launcher.readSettings()) }; } catch (e) { notify(e.message, true); } render(); applyLanguage(); try { const version = await window.launcher.getLauncherVersion(); byId('launcherVersionLabel').textContent = 'MaoLauncher v' + version; } catch {} await refreshState(); checkServer(); checkUpdates('updateHint', true); loadNews(); setInterval(loadNews, 15 * 60 * 1000); })();

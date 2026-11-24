const defaults = { memory: 4096, launchArguments: '', theme: 'auto', language: 'ru', minimizeBehavior: 'tray', snowfall: true, autoUpdateChecks: true, profiles: [], activeProfile: '', news: [] };
let config = { ...defaults }, gameInstalled = false, gameBusy = false, gameRunning = false, gameUpdateAvailable = false, launcherUpdateAvailable = false, toastTimer;
const gameConsoleLines = [];
const byId = (id) => document.getElementById(id);
function configureNavigation() {
  const profileButton = document.querySelector('.profileDockMount [data-view="profileview"]');
  const mapButton = document.querySelector('.nav button[data-view="mapview"]');
  const serverButton = document.querySelector('.nav button[data-view="serverview"]');
  const aboutButton = document.querySelector('.nav button[data-view="aboutview"]');
  const settings = document.querySelector('#settingsview .launcherSettings');
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
    mapButton.innerHTML = '<span>▧</span><span class="navText">Карта сервера</span>';
  }
  const gameVersionLabel = serverStrip.querySelector('#gameVersion')?.parentElement?.querySelector('small');
  if (gameVersionLabel) gameVersionLabel.textContent = 'Версия сервера';
  const homeBuildHeading = [...home.querySelectorAll('.sectionhead')].find(item => item.querySelector('h2')?.textContent.trim() === 'Сборка сервера');
  homeBuildHeading?.nextElementSibling?.remove();
  homeBuildHeading?.remove();
  home.querySelector('[data-quick=top]')?.remove();
  home.querySelector('[data-quick=shop]')?.remove();
  const communityLinks = [
    [home.querySelector('[data-quick="discord"]'), 'https://discord.gg/CFQZPmqdZ2', 'Discord', ''],
    [home.querySelector('[data-quick="website"]'), 'https://maopickme.ru/', 'Сайт', 'site.png'],
    [home.querySelector('[data-quick="telegram"]'), 'https://t.me/+RFqx4ziQjLQzNGYy', 'Telegram', 'tg.png'],
  ];
  for (const [link, href, label, icon] of communityLinks) {
    if (!link) continue;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<span class="quickIcon">${icon ? `<img src="assets/${icon}" alt="">` : '◉'}</span>${label}`;
  }
  const offlineIcon = document.querySelector('#offlineChoice .accountIcon');
  if (offlineIcon) offlineIcon.innerHTML = '<img alt="" src="https://mc-heads.net/avatar/Steve/42">';
  const profileInput = byId('profileName');
  if (profileInput) profileInput.style.cssText = 'display:block;visibility:visible;opacity:1;flex:1;min-width:220px;height:42px;padding:10px 12px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--text);caret-color:var(--accent2);pointer-events:auto;user-select:text;-webkit-app-region:no-drag';
  home.querySelector('.sidepanel .address')?.remove();
  home.querySelector('#copyAddress')?.remove();
  const sideStatus = byId('sideStatus');
  if (sideStatus) sideStatus.textContent = 'Состояние сервера';
  if (profileButton) {
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
    document.querySelector('.profileDockMount')?.append(dock);
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
    details.textContent = [...source.querySelectorAll('.muted')].map(item => item.textContent.replaceAll('mc.maopickme.ru', 'MaoPickMe')).join(' · ');
    const row = document.createElement('div');
    row.className = 'settingsRow';
    row.append(title, details);
    settings.append(row);
    aboutView.remove();
  }
}
const safe = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#39;');
function notify(message, error = false) { const toast = byId('toast'); toast.textContent = message; toast.classList.toggle('error', error); toast.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4200); }
let supportNoticeTimer = null;
function showSupportNotice(message, error = false) { const notice = byId('supportNotice'); if (!notice) { notify(message, error); return; } byId('supportNoticeIcon').textContent = error ? '×' : '✓'; byId('supportNoticeMessage').textContent = message; notice.classList.toggle('error', error); notice.hidden = false; clearTimeout(supportNoticeTimer); supportNoticeTimer = setTimeout(() => { notice.hidden = true; }, 3000); }
byId('supportNotice')?.addEventListener('click', () => { byId('supportNotice').hidden = true; clearTimeout(supportNoticeTimer); });
let snowfallFrame = 0, snowfallCanvas, snowfallContext, snowfallParticles = [], snowfallLastTime = 0;
function resizeSnowfall() {
  if (!snowfallCanvas || !snowfallContext) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  const width = window.innerWidth, height = window.innerHeight;
  snowfallCanvas.width = Math.round(width * ratio);
  snowfallCanvas.height = Math.round(height * ratio);
  snowfallCanvas.style.width = width + 'px';
  snowfallCanvas.style.height = height + 'px';
  snowfallContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  const count = Math.min(54, Math.max(18, Math.round(width * height / 30000)));
  snowfallParticles = Array.from({ length: count }, () => ({
    x: Math.random() * width, y: Math.random() * height,
    size: 3 + Math.random() * 4.5,
    speed: .28 + Math.random() * .48,
    drift: -.18 + Math.random() * .36,
    phase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() * .012 + .004) * (Math.random() < .5 ? -1 : 1),
    opacity: .35 + Math.random() * .4
  }));
  snowfallLastTime = 0;
}
function drawSnowfall(timestamp) {
  if (!config.snowfall || !snowfallContext) { snowfallFrame = 0; snowfallLastTime = 0; return; }
  const ctx = snowfallContext, width = window.innerWidth, height = window.innerHeight;
  const elapsed = snowfallLastTime ? Math.min(40, Math.max(0, timestamp - snowfallLastTime)) : 16.67;
  const step = elapsed / 16.67;
  snowfallLastTime = timestamp;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(224, 211, 246, .92)';
  ctx.lineWidth = 1.15;
  ctx.lineCap = 'round';
  for (const flake of snowfallParticles) {
    flake.phase += .012 * step;
    flake.x += (flake.drift + Math.sin(flake.phase) * .16) * step;
    flake.y += flake.speed * step;
    flake.rotation += flake.rotationSpeed * step;
    if (flake.y > height + 10) { flake.y = -10; flake.x = Math.random() * width; }
    if (flake.x < -10) flake.x = width + 10;
    if (flake.x > width + 10) flake.x = -10;
    const arm = flake.size;
    ctx.save();
    ctx.translate(flake.x, flake.y);
    ctx.rotate(flake.rotation);
    ctx.globalAlpha = flake.opacity;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI / 3;
      const dx = Math.cos(angle) * arm, dy = Math.sin(angle) * arm;
      ctx.moveTo(-dx, -dy); ctx.lineTo(dx, dy);
      for (const side of [-1, 1]) {
        const bx = Math.cos(angle) * arm * .58, by = Math.sin(angle) * arm * .58;
        const branch = arm * .32, branchAngle = angle + side * .78;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(branchAngle) * branch, by - Math.sin(branchAngle) * branch);
        ctx.moveTo(-bx, -by);
        ctx.lineTo(-bx + Math.cos(branchAngle) * branch, -by + Math.sin(branchAngle) * branch);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  snowfallFrame = requestAnimationFrame(drawSnowfall);
}
function applySnowfall() {
  if (!snowfallCanvas) {
    snowfallCanvas = document.createElement('canvas');
    snowfallCanvas.className = 'snowfallCanvas';
    snowfallCanvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(snowfallCanvas);
    snowfallContext = snowfallCanvas.getContext('2d', { alpha: true });
    resizeSnowfall();
    window.addEventListener('resize', resizeSnowfall, { passive: true });
  }
  snowfallCanvas.hidden = !config.snowfall;
  if (config.snowfall && !snowfallFrame) { snowfallLastTime = 0; snowfallFrame = requestAnimationFrame(drawSnowfall); }
  if (!config.snowfall && snowfallFrame) { cancelAnimationFrame(snowfallFrame); snowfallFrame = 0; snowfallLastTime = 0; snowfallContext?.clearRect(0, 0, window.innerWidth, window.innerHeight); }
}
function formatNewsText(value) {
  const source = String(value ?? '').replace(/\\\r?\n/g, '\n').replace(/\\n/g, '\n');
  const linkPattern = /\[([^\]]+)\]\((https:\/\/(?:vk\.ru|vk\.com)\/[^\s)]+)\)/g;
  let html = '', last = 0, match;
  const escapeText = text => safe(text)
    .replace(/&amp;#(x[0-9a-f]+|[0-9]+);/gi, '&#$1;')
    .replace(/\r?\n/g, '<br>');
  while ((match = linkPattern.exec(source))) {
    html += escapeText(source.slice(last, match.index));
    const label = escapeText(match[1]);
    const url = match[2];
    if (/^https:\/\/vk\.ru\/emoji\/e\/[a-f0-9]+_2x\.png$/i.test(url)) {
      html += "<img class='vkEmoji' alt='" + safe(match[1]) + "' src='" + safe(url) + "'>";
    } else {
      html += "<a class='newsInlineLink' href='" + safe(url) + "' target='_blank' rel='noopener noreferrer'>" + label + "</a>";
    }
    last = linkPattern.lastIndex;
  }
  html += escapeText(source.slice(last));
  return html;
}
function renderNews(news, featured = false, compact = false) {
  if (!news.length) return "<article class='news newsEmpty'><div class='newsIcon'>✦</div><div class='newsText'><span class='tag'>НОВОСТИ</span><h3>Пока нет новостей</h3><p>Новости сообщества появятся здесь после загрузки.</p></div></article>";
  return news.map((item, index) => {
    const isFeatured = featured && index === 0;
    const image = item.image ? "<div class='newsCover'><img alt='' src='" + safe(item.image) + "'></div>" : '';
    if (compact) return "<article class='newsCard newsHomeCard' role='button' tabindex='0' data-home-news-index='" + index + "'>" + image + "<div class='newsText'><h3>" + safe(item.title || 'Новость') + "</h3></div></article>";
    const content = image + "<div class='newsText'><span class='tag'>" + safe(item.tag || 'НОВОСТЬ') + ' · ' + safe(item.date || '') + "</span><h3>" + safe(item.title) + "</h3><div class='newsBody'>" + formatNewsText(item.text) + "</div>" +
      (item.url && /^https:\/\/(vk\.ru|vk\.com)\//i.test(item.url) ? "<span class='newsReadMore'>Открыть публикацию ↗</span>" : '') + "</div>";
    const classes = "newsCard" + (isFeatured ? " newsFeatured" : "");
    return item.url && /^https:\/\/(vk\.ru|vk\.com)\//i.test(item.url)
      ? "<a class='" + classes + " newsLink' href='" + safe(item.url) + "' target='_blank' rel='noopener noreferrer'>" + content + "</a>"
      : "<article class='" + classes + "'>" + content + "</article>";
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
    ? '<img class="profileButtonAvatar" alt="" src="https://mc-heads.net/avatar/' + encodeURIComponent(active.name) + '/32"><span class="profileIdentity"><span class="profileNickname">' + safe(active.name) + '</span><small class="profileType">' + (active.type === 'elyby' ? 'Ely.by' : 'Оффлайн') + '</small></span>'
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
function renderPlayButton() { const b = byId('playButton'); b.textContent = gameRunning ? 'Игра запущена' : gameBusy ? 'Подготовка…' : (launcherUpdateAvailable || gameUpdateAvailable) ? 'Обновить' : gameInstalled ? 'Играть' : 'Установить'; b.disabled = gameBusy || gameRunning; }
const originalTextNodes = new WeakMap();
const englishText = {
  'МЕНЮ':'MENU','Главная':'Home','Новости':'News','Карта сервера':'Server map','Поддержка':'Support','Сервер':'Server','Настройки':'Settings','Профиль':'Profile','Обновления':'Updates','О лаунчере':'About',
  'Твой путь в мир Minecraft начинается здесь!':'Your Minecraft adventure starts here!',
  'Новости сервера':'Server news','Последние объявления сообщества':'Latest community announcements','Пока нет новостей':'No news yet',
  'Сборка сервера':'Server modpack','Автоматическая установка Fabric-модов':'Automatic Fabric mod installation','Быстрый доступ':'Quick links','Мы на связи':'Stay connected','Автопроверка обновлений':'Automatic update checks','Проверять новые версии при запуске и каждые 30 минут':'Check for new versions at startup and every 30 minutes',
  'Игроки онлайн':'Players online','Версия клиента':'Client version','Подробнее':'Details','Копировать IP':'Copy IP',
  'Добавить профиль':'Add profile','Выберите способ входа в MaoLauncher':'Choose how to sign in to MaoLauncher',
  'Оффлайн':'Offline','Создать локальный профиль по нику':'Create a local profile by username','Вход через учётную запись Ely.by':'Sign in with Ely.by',
  'Ник игрока':'Player name','Создать профиль':'Create profile','Назад к выбору':'Back to choices',
  'Оперативная память':'Memory','Максимум для Minecraft':'Maximum for Minecraft','Настройка игры':'Game settings','Параметры запуска Minecraft':'Minecraft launch options','Выделенная память для Minecraft':'Memory allocated to Minecraft','Выбрано':'Selected','Папка игры':'Game folder','Интерфейс':'Interface','Внешний вид и поведение окна':'Appearance and window behavior','Лаунчер':'Launcher','Обновление и информация о приложении':'Updates and app information','Проверка версий лаунчера и модов':'Checking launcher and mod versions','Независимый проект':'Independent project','МБ':'MB','Тема':'Theme','Светлая, тёмная или системная':'Light, dark or system',
  'Язык':'Language','Язык интерфейса':'Interface language','Файлы игры':'Game files','Папка Minecraft и модов':'Minecraft and mods folder',
  'Открыть папку':'Open folder','Проверить обновления':'Check for updates','Сворачивание лаунчера':'Minimize behavior','Снежинки на фоне':'Snowfall background','Включить или отключить анимацию снега':'Enable or disable the snowfall animation','Включено':'Enabled',
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
  byId('closeWindow').title = english ? 'Close' : 'Закрыть';
}
function render() { document.title = 'MaoLauncher'; const homeNewsTitle = byId('homeNewsTitle'); if (homeNewsTitle) homeNewsTitle.textContent = 'Новости сервера'; byId('homeNews').innerHTML = renderNews((config.news || []).slice(0, 3), true, true); byId('allNews').innerHTML = renderNews(config.news || []); const newsTitle = byId('newsPageTitle'); if (newsTitle) newsTitle.textContent = 'Новости сервера'; const newsSubtitle = byId('newsPageSubtitle'); if (newsSubtitle) newsSubtitle.textContent = 'Объявления сообщества'; const memory = Math.max(2048, Math.min(16384, Math.round(Number(config.memory) || 4096))); byId('memorySetting').value = String(memory); byId('memoryManual').value = String(memory); byId('memorySetting').style.setProperty('--memory-progress', ((memory - 2048) / (16384 - 2048) * 100) + '%'); byId('themeSetting').value = config.theme; byId('snowfallSetting').checked = config.snowfall !== false; byId('autoUpdateSetting').checked = config.autoUpdateChecks !== false; byId('languageSetting').value = config.language; byId('minimizeBehavior').value = config.minimizeBehavior || 'tray'; if (byId('launchArgumentsSetting')) byId('launchArgumentsSetting').value = config.launchArguments || '';  document.documentElement.dataset.theme = config.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : config.theme; renderProfiles(); renderPlayButton(); applySnowfall(); }
async function refreshState() { try { const state = await window.launcher.gameState(); gameInstalled = Boolean(state.installed); gameRunning = Boolean(state.running); } catch { gameInstalled = false; gameRunning = false; } renderPlayButton(); }
function setUnavailable(message, status = 'Нет данных') { byId('serverStatus').textContent = status; byId('players').textContent = '— / —'; if (byId('ping')) byId('ping').textContent = '— мс'; byId('topStatus').textContent = status.toUpperCase(); byId('topStatus').className = 'pill bad'; byId('sideStatus').textContent = 'Статистика недоступна'; byId('serverError').textContent = message || ''; byId('avatars').replaceChildren(); byId('serverStatusDetail').textContent = status; byId('playersDetail').textContent = '— / —'; byId('pingDetail').textContent = '— мс'; byId('serverVersionDetail').textContent = '—'; }
let serverCheckPromise = null;
async function checkServer() {
  if (serverCheckPromise) return serverCheckPromise;
  serverCheckPromise = (async () => {
  byId('serverStatus').textContent = 'Проверяем сервер…'; byId('serverError').textContent = '';
  try {
    const r = await window.launcher.serverStatus();
    if (!r.online) return setUnavailable(r.dnsError || r.error || 'Нет ответа', 'Не в сети');
    const count = r.players.online + ' / ' + r.players.max, ping = Number.isFinite(r.ping) ? r.ping + ' мс' : '— мс';
    byId('gameVersion').textContent = r.version || '—';
    byId('serverStatus').textContent = 'Сервер онлайн'; byId('players').textContent = count; if (byId('ping')) byId('ping').textContent = ping; byId('topStatus').textContent = 'ОНЛАЙН'; byId('topStatus').className = 'pill good'; byId('sideStatus').textContent = ''; if (byId('serverAddressDetail')) byId('serverAddressDetail').textContent = r.address || 'm30.joinserver.xyz:25737';
    byId('serverStatusDetail').textContent = 'Сервер онлайн'; byId('playersDetail').textContent = count; byId('pingDetail').textContent = ping; byId('serverVersionDetail').textContent = r.version || 'Неизвестно';
    const sample = r.players.sample || []; byId('avatars').innerHTML = sample.slice(0, 5).map(p => "<img class='avatar' title='" + safe(p.name) + "' alt='Скин игрока' src='https://mc-heads.net/avatar/" + encodeURIComponent(p.uuid || p.name) + "/30'>").join('') + (r.players.online > 5 ? '<span class=more>+' + (r.players.online - 5) + '</span>' : '');
  } catch (e) { setUnavailable(e.message); }
  })();
  try { return await serverCheckPromise; } finally { serverCheckPromise = null; }
}
configureNavigation();
const newsDetailOverlay = document.createElement('div');
newsDetailOverlay.className = 'newsDetailOverlay';
newsDetailOverlay.id = 'newsDetailOverlay';
newsDetailOverlay.innerHTML = "<div class='newsDetailDialog' role='dialog' aria-modal='true' aria-label='Новость'><button class='newsDetailClose' type='button' aria-label='Закрыть'>×</button><div class='newsDetailContent'></div></div>";
document.body.append(newsDetailOverlay);
function openHomeNews(index) {
  const item = config.news[index];
  if (!item) return;
  newsDetailOverlay.querySelector('.newsDetailContent').innerHTML = renderNews([item]);
  newsDetailOverlay.classList.add('open');
}
byId('homeNews')?.addEventListener('click', event => {
  const card = event.target.closest('[data-home-news-index]');
  if (card) openHomeNews(Number(card.dataset.homeNewsIndex));
});
byId('homeNews')?.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-home-news-index]')) {
    event.preventDefault(); openHomeNews(Number(event.target.dataset.homeNewsIndex));
  }
});
newsDetailOverlay.querySelector('.newsDetailClose').addEventListener('click', () => newsDetailOverlay.classList.remove('open'));
newsDetailOverlay.addEventListener('click', event => { if (event.target === newsDetailOverlay) newsDetailOverlay.classList.remove('open'); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') newsDetailOverlay.classList.remove('open'); });
const sidebar = document.querySelector('aside');
let sidebarExpanded = document.body.classList.contains('sidebar-expanded');
let sidebarResizeQueue = Promise.resolve();
function setSidebarExpanded(expanded) {
  if (sidebarExpanded === expanded) return sidebarResizeQueue;
  sidebarExpanded = expanded;
  document.body.classList.toggle('sidebar-expanded', expanded);
  sidebarResizeQueue = sidebarResizeQueue.then(() => window.launcher.setSidebarExpanded(expanded)).catch(error => {
    if (sidebarExpanded === expanded) {
      sidebarExpanded = !expanded;
      document.body.classList.toggle('sidebar-expanded', !expanded);
    }
    notify(error.message, true);
  });
  return sidebarResizeQueue;
}
sidebar?.addEventListener('mouseenter', () => setSidebarExpanded(true));
sidebar?.addEventListener('mouseleave', () => setSidebarExpanded(false));
const TWITCH_STREAMERS = [{ name: 'niriska', url: 'https://www.twitch.tv/niriska' }, { name: 'similar_cav', url: 'https://www.twitch.tv/similar_cav' }, { name: 'tomskiybtw', url: 'https://www.twitch.tv/tomskiybtw' }];
let twitchRefreshPromise = null;
async function readTwitchStreamer(streamer, status) {
  if (status?.unavailable) throw new Error(status.error || 'Twitch status unavailable');
  return { ...streamer, live: Boolean(status?.live), uptime: status?.uptime || '', title: status?.title || '', category: status?.category || '', viewers: Number.isFinite(status?.viewers) ? status.viewers : null };
}
function updateTwitchStreamInfo(stream) {
  byId('twitchPlayerName').textContent = stream.name;
  byId('twitchPlayerTitle').textContent = stream.title || 'Прямая трансляция';
  byId('twitchPlayerStatus').textContent = 'В эфире';
  byId('twitchPlayerUptime').textContent = stream.uptime || '—';
  byId('twitchPlayerViewers').textContent = stream.viewers === null ? '—' : stream.viewers.toLocaleString('ru-RU');
  byId('twitchPlayerCategory').textContent = stream.category || '—';
}
function selectTwitchStream(stream) {
  const frame = byId('twitchPlayerFrame'), placeholder = byId('twitchPlayerPlaceholder');
  if (!frame || !stream?.live) return;
  const parent = location.hostname || '127.0.0.1';
  frame.src = 'https://player.twitch.tv/?channel=' + encodeURIComponent(stream.name) + '&parent=' + encodeURIComponent(parent) + '&autoplay=false&muted=false';
  frame.hidden = false; placeholder.hidden = true;
  updateTwitchStreamInfo(stream);
}
function setStreamerAvatarFallback(image) {
  image.hidden = true;
  const fallback = image.nextElementSibling;
  if (fallback) fallback.hidden = false;
}
async function loadStreamerAvatar(card, streamer) {
  const image = card.querySelector('.streamAvatar');
  if (!image) return;
  const fallback = image.nextElementSibling;
  image.addEventListener('error', () => {
    if (image.dataset.fallbackTried !== 'true') {
      image.dataset.fallbackTried = 'true';
      image.src = 'https://avatarsapi.com/twitch/' + encodeURIComponent(streamer.name) + '?size=96';
      return;
    }
    setStreamerAvatarFallback(image);
  });
  try {
    const response = await fetch('https://decapi.me/twitch/avatar/' + encodeURIComponent(streamer.name), { cache: 'no-store' });
    if (!response.ok) throw new Error('Avatar lookup failed');
    const avatarUrl = (await response.text()).trim();
    if (!/^https:\/\//i.test(avatarUrl)) throw new Error('Invalid avatar URL');
    image.src = avatarUrl;
  } catch {
    image.dataset.fallbackTried = 'true';
    image.src = 'https://avatarsapi.com/twitch/' + encodeURIComponent(streamer.name) + '?size=96';
  }
  if (fallback) fallback.textContent = streamer.name.slice(0, 1).toUpperCase();
}
async function refreshTwitchStreams() {
  if (twitchRefreshPromise) return twitchRefreshPromise;
  const directory = byId('streamDirectory'), liveList = byId('liveStreams');
  if (!directory || !liveList) return;
  twitchRefreshPromise = (async () => {
    directory.innerHTML = TWITCH_STREAMERS.map(streamer => '<a class="streamDirectoryCard" data-streamer="' + safe(streamer.name) + '" href="' + streamer.url + '" target="_blank" rel="noopener noreferrer"><img class="streamAvatar" alt="" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="><span class="streamAvatarFallback" hidden>' + safe(streamer.name.slice(0, 1).toUpperCase()) + '</span><span class="streamDetails"><strong>' + safe(streamer.name) + '</strong><span class="streamState"><i></i><span>Проверяем статус…</span></span></span></a>').join('');
    let statuses = [];
    try { statuses = await window.launcher.getTwitchStreams(); } catch {}
    const results = await Promise.all(TWITCH_STREAMERS.map(async streamer => {
      const status = statuses.find(item => item.name === streamer.name);
      try { return await readTwitchStreamer(streamer, status || { unavailable: true, error: 'Не удалось получить статус' }); }
      catch { return { ...streamer, live: false, unavailable: true, uptime: '', title: '' }; }
    }));
    await Promise.all(TWITCH_STREAMERS.map(streamer => {
      const card = directory.querySelector('[data-streamer="' + streamer.name + '"]');
      return card ? loadStreamerAvatar(card, streamer) : Promise.resolve();
    }));
    for (const result of results) {
      const card = directory.querySelector('[data-streamer="' + result.name + '"]');
      if (!card) continue;
      card.classList.toggle('isLive', result.live);
      const label = card.querySelector('.streamState span');
      if (label) label.textContent = result.unavailable ? 'Статус недоступен' : result.live ? 'В эфире · ' + result.uptime : 'Не в сети';
    }
    const active = results.filter(result => result.live);
    const selectedName = byId('twitchPlayerName')?.textContent;
    const selected = active.find(item => item.name === selectedName);
    if (selected) updateTwitchStreamInfo(selected);
    else if (active.length) selectTwitchStream(active[0]);
    else if (selectedName && selectedName !== 'Трансляция не выбрана') {
      byId('twitchPlayerFrame').removeAttribute('src');
      byId('twitchPlayerFrame').hidden = true;
      byId('twitchPlayerPlaceholder').hidden = false;
      byId('twitchPlayerName').textContent = 'Трансляция не выбрана';
      byId('twitchPlayerTitle').textContent = 'Выбранный канал завершил эфир';
      byId('twitchPlayerStatus').textContent = 'Не в эфире';
      byId('twitchPlayerUptime').textContent = '—';
      byId('twitchPlayerViewers').textContent = '—';
      byId('twitchPlayerCategory').textContent = '—';
    }
    liveList.innerHTML = active.length ? active.map(result => '<button class="liveStreamCard" type="button" data-live-channel="' + safe(result.name) + '"><span class="liveBadge">● LIVE</span><strong>' + safe(result.name) + '</strong><small>' + safe(result.title || 'Прямая трансляция') + '</small><span class="liveStreamMeta"><span>◷ ' + safe(result.uptime || '—') + '</span><span>◉ ' + (result.viewers === null ? '—' : result.viewers.toLocaleString('ru-RU')) + ' зрителей</span><span>▣ ' + safe(result.category || 'Категория не указана') + '</span></span></button>').join('') : '<div class="streamEmpty">Сейчас никто из добавленных стримеров не в эфире.</div>';
    liveList.querySelectorAll('[data-live-channel]').forEach(card => card.addEventListener('click', () => { const stream = active.find(item => item.name === card.dataset.liveChannel); if (stream) selectTwitchStream(stream); }));
  })().finally(() => { twitchRefreshPromise = null; });
  return twitchRefreshPromise;
}
byId('refreshTwitchStreams')?.addEventListener('click', refreshTwitchStreams);
function navigate(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id)); document.querySelectorAll('[data-view]').forEach(v => v.classList.toggle('active', v.dataset.view === id)); byId('crumb').textContent = ({ home: 'Главная', serverview: 'Сервер', newsview: 'Новости', settingsview: 'Настройки', profileview: 'Профиль', mapview: 'Карта сервера', streamsview: 'Стримы', supportview: 'Поддержка', consoleview: 'Консоль', updatesview: 'Обновления', aboutview: 'О лаунчере' })[id] || 'Главная'; if (id === 'streamsview') refreshTwitchStreams(); }

document.querySelectorAll('[data-view],[data-go]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'profileview') return; navigate(b.dataset.view || b.dataset.go); }));
byId('playButton').addEventListener('click', async () => { if (gameRunning) return; if (launcherUpdateAvailable) { gameBusy = true; renderPlayButton(); byId('progressWrap').hidden = false; byId('progressBar').style.width = '2%'; byId('progressText').textContent = 'Подготовка обновления…'; try { const result = await window.launcher.installLauncherUpdate(); if (result.upToDate) { launcherUpdateAvailable = false; gameBusy = false; renderPlayButton(); notify('Установлена последняя версия MaoLauncher.'); } } catch (error) { notify(error.message, true); gameBusy = false; renderPlayButton(); } return; } if (!config.activeProfile) { navigate('profileview'); document.querySelector('.accountChoices').hidden = true; byId('offlineForm').hidden = false; requestAnimationFrame(() => byId('profileName').focus()); notify('Введите ник, чтобы создать офлайн-профиль.', true); return; } gameBusy = true; renderPlayButton(); byId('progressWrap').hidden = false; byId('progressText').textContent = 'Подготовка Fabric 26.2…'; try { const r = await window.launcher.installGame(); gameInstalled = true; gameUpdateAvailable = false; byId('progressWrap').hidden = true; byId('progressText').textContent = ''; notify(r.started ? 'Игра запущена на mc.maopickme.ru.' : 'Игра установлена.'); } catch (e) { notify(e.message, true); await refreshState(); } finally { gameBusy = false; renderPlayButton(); } });
byId('offlineChoice').addEventListener('click', () => { document.querySelector('.accountChoices').hidden = true; byId('offlineForm').hidden = false; const field = byId('profileName'); field.disabled = false; field.readOnly = false; requestAnimationFrame(() => field.focus()); });
byId('elybyChoice').addEventListener('click', () => { document.querySelector('.accountChoices').hidden = true; byId('elybyNotice').hidden = false; });
byId('backToAccountChoices').addEventListener('click', showAccountChoices);
async function createOfflineProfile() { const name = byId('profileName').value.trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) { notify('Ник: 3–16 символов, латиница, цифры или _.', true); byId('profileName').focus(); return; } try { config = await window.launcher.addProfile(name); byId('profileName').value = ''; showAccountChoices(); renderProfiles(); notify('Офлайн-профиль создан.'); } catch (e) { notify(e.message, true); } }
byId('addProfile').addEventListener('click', createOfflineProfile);
byId('profileName').addEventListener('keydown', event => { if (event.key === 'Enter') createOfflineProfile(); });
let skinPreviewViewer = null, skinLookupTimer = null, skinLookupSequence = 0;
function setSkinPreviewState(state, message) {
  const root = byId('skinPreview3d');
  if (!root) return;
  root.classList.toggle('loading', state === 'loading');
  root.classList.toggle('fallback', state === 'fallback');
  const label = byId('skinPreviewStatus');
  if (label) label.textContent = message || '';
}
function initSkinPreview() {
  if (skinPreviewViewer || !window.skinview3d || !byId('profileSkinCanvas')) return Boolean(skinPreviewViewer);
  try {
    skinPreviewViewer = new window.skinview3d.SkinViewer({
      canvas: byId('profileSkinCanvas'),
      width: 220,
      height: 250,
      background: null,
      skin: 'https://mc-heads.net/skin/Steve'
    });
    skinPreviewViewer.controls.enableRotate = true;
    skinPreviewViewer.controls.enableZoom = false;
    skinPreviewViewer.controls.enablePan = false;
    skinPreviewViewer.animation = new window.skinview3d.IdleAnimation();
    skinPreviewViewer.zoom = 0.9;
    return true;
  } catch (error) {
    console.warn('3D skin preview initialization failed:', error);
    setSkinPreviewState('fallback', '3D-предпросмотр недоступен');
    return false;
  }
}
async function lookupOfficialSkin(name, sequence) {
  const result = await window.launcher.lookupOfficialSkin(name);
  if (sequence !== skinLookupSequence) return null;
  return result?.found ? result.skinUrl : null;
}
async function updateSkinPreview(rawName) {
  initSkinPreview();
  const name = String(rawName || '').trim();
  const sequence = ++skinLookupSequence;
  const fallback = byId('profileSkinFallback');
  if (!name || !/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    if (skinPreviewViewer) await skinPreviewViewer.loadSkin('https://mc-heads.net/skin/Steve').catch(() => {});
    if (fallback) fallback.src = 'https://mc-heads.net/avatar/Steve/100';
    setSkinPreviewState('ready', 'Введите ник игрока');
    return;
  }
  setSkinPreviewState('loading', 'Ищем официальный скин…');
  try {
    const skinUrl = await lookupOfficialSkin(name, sequence);
    if (sequence !== skinLookupSequence) return;
    if (!skinUrl) {
      if (skinPreviewViewer) await skinPreviewViewer.loadSkin('https://mc-heads.net/skin/Steve');
      if (fallback) fallback.src = 'https://mc-heads.net/avatar/Steve/100';
      setSkinPreviewState('ready', 'Официальный скин не найден · Steve');
      return;
    }
    if (!initSkinPreview()) throw new Error('3D renderer unavailable');
    await skinPreviewViewer.loadSkin(skinUrl);
    if (sequence !== skinLookupSequence) return;
    if (fallback) fallback.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/100';
    setSkinPreviewState('ready', 'Официальный скин · ' + name + ' · перетаскивай для вращения');
  } catch (error) {
    if (sequence !== skinLookupSequence) return;
    console.warn('Official skin lookup failed:', error);
    if (skinPreviewViewer) {
      try { await skinPreviewViewer.loadSkin('https://mc-heads.net/skin/Steve'); } catch {}
      if (fallback) fallback.src = 'https://mc-heads.net/avatar/Steve/100';
      setSkinPreviewState('ready', 'Ошибка проверки ника · ' + String(error?.message || 'сервис недоступен') + ' · Steve');
    } else {
      if (fallback) fallback.src = 'https://mc-heads.net/avatar/Steve/100';
      setSkinPreviewState('fallback', '3D-предпросмотр недоступен · Steve');
    }
  }
}
byId('profileName').addEventListener('input', event => {
  const name = event.target.value.trim();
  clearTimeout(skinLookupTimer);
  skinLookupTimer = setTimeout(() => updateSkinPreview(name), 450);
  const avatarName = /^[A-Za-z0-9_]{3,16}$/.test(name) ? name : 'Steve';
  const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(avatarName) + '/42';
  const icon = document.querySelector('#offlineChoice .accountIcon');
  if (icon) icon.innerHTML = '<img alt="Аватар скина ' + safe(avatarName) + '" src="' + avatar + '">';
});
byId('offlineChoice').addEventListener('click', () => {
  setSkinPreviewState('ready', 'Загружаем 3D-модель…');
  if (!initSkinPreview()) setSkinPreviewState('fallback', '3D-предпросмотр недоступен');
  updateSkinPreview(byId('profileName').value);
});
byId('reloadMap').addEventListener('click', () => { const frame = byId('serverMap'); frame.src = 'http://135.181.126.154:25602/?refresh=' + Date.now(); });
async function copyAddress() { await navigator.clipboard.writeText('mc.maopickme.ru'); notify('IP mc.maopickme.ru скопирован.'); }
['copyAddress', 'copySide', 'copyDetail'].forEach(id => byId(id)?.addEventListener('click', copyAddress)); byId('refreshServer').addEventListener('click', checkServer);
function updateMemoryPreview(value) { const memory = Math.max(2048, Math.min(16384, Math.round(Number(value)))); byId('memorySetting').value = String(memory); byId('memoryManual').value = String(memory); byId('memorySetting').style.setProperty('--memory-progress', ((memory - 2048) / (16384 - 2048) * 100) + '%'); return memory; }
async function saveMemory(value) { const memory = updateMemoryPreview(value); config = await window.launcher.saveSettings({ ...config, memory }); render(); }
byId('memorySetting').addEventListener('input', event => updateMemoryPreview(event.target.value));
byId('memorySetting').addEventListener('change', event => saveMemory(event.target.value).catch(error => notify(error.message, true)));
byId('memoryManual').addEventListener('change', event => { const value = Number(event.target.value); if (!Number.isFinite(value) || value < 2048 || value > 16384) { notify('Укажи память от 2048 до 16384 МБ.', true); render(); return; } saveMemory(value).catch(error => notify(error.message, true)); });
for (const [id, key] of [['themeSetting', 'theme'], ['languageSetting', 'language'], ['minimizeBehavior', 'minimizeBehavior'], ['snowfallSetting', 'snowfall'], ['autoUpdateSetting', 'autoUpdateChecks']]) byId(id).addEventListener('change', async e => {
  const previous = config;
  try {
    config = await window.launcher.saveSettings({ ...config, [key]: ['snowfall', 'autoUpdateChecks'].includes(key) ? e.target.checked : e.target.value });
    render();
    if (key === 'language') applyLanguage();
  } catch (error) {
    config = previous;
    render();
    if (key === 'language') applyLanguage();
    notify('Не удалось сохранить настройку: ' + error.message, true);
  }
});
byId('launchArgumentsSetting')?.addEventListener('change', async event => { const previous = config; try { config = await window.launcher.saveSettings({ ...config, launchArguments: event.target.value.trim() }); notify('Аргументы запуска сохранены.'); } catch (error) { config = previous; render(); notify('Не удалось сохранить аргументы: ' + error.message, true); } });
byId('openFolder').addEventListener('click', async () => { const error = await window.launcher.openGameFolder(); if (error) notify(error, true); });
byId('changeGameFolder')?.addEventListener('click', async () => { try { const result = await window.launcher.chooseGameFolder(); if (result?.canceled) return; if (result?.error) throw new Error(result.error); await refreshState(); notify('Папка игры изменена: ' + result.path); } catch (error) { notify(error.message, true); } });
byId('clearConsole')?.addEventListener('click', () => { gameConsoleLines.length = 0; byId('gameConsole').textContent = 'Консоль очищена.'; });
async function checkUpdates(hintId = 'updateHint', silent = false) { const hint = byId(hintId); if (hint) hint.textContent = 'Проверяем обновления MaoLauncher и модов…'; try { const r = await window.launcher.checkUpdates(); launcherUpdateAvailable = Boolean(r.launcherUpdate); gameUpdateAvailable = r.modUpdates.length > 0; renderPlayButton(); const latestVersion = r.latestLauncherVersion ? 'MaoLauncher v' + r.latestLauncherVersion + '. ' : ''; if (hint) hint.textContent = latestVersion + (launcherUpdateAvailable ? 'Доступна новая версия. Нажмите «Обновить» на главной.' : gameUpdateAvailable ? 'Доступны обновления модов: ' + r.modUpdates.join(', ') + '. Нажмите «Обновить» на главной.' : 'Установленные моды обновлены до последних версий.'); if (!silent) notify(launcherUpdateAvailable ? 'Доступно обновление MaoLauncher ' + r.latestLauncherVersion + '.' : 'Проверка завершена.'); } catch (err) { if (hint) hint.textContent = err.message; if (!silent) notify(err.message, true); } }
async function sendSupportRequest() {
  const subject = byId('supportSubject').value.trim();
  const message = byId('supportMessage').value.trim();
  const button = byId('supportSend');
  const hint = byId('supportFormHint');
  if (!subject || !message) { showSupportNotice('Заполни заголовок и сообщение.', true); return; }
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Отправляем…';
  if (hint) hint.textContent = 'Отправляем обращение…';
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_mdy3gqa',
        template_id: 'template_i52qgrl',
        user_id: 'IpDZGs1n3Af92cMem',
        template_params: { subject, message, title: subject, content: message }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(details || 'EmailJS вернул HTTP ' + response.status);
    }
    byId('supportSubject').value = '';
    byId('supportMessage').value = '';
    if (hint) hint.textContent = 'Обращение успешно отправлено.';
    showSupportNotice('Обращение успешно отправлено. Спасибо!');
  } catch (error) {
    if (hint) hint.textContent = 'Не удалось отправить обращение. Попробуйте ещё раз.';
    showSupportNotice('Не удалось отправить обращение. Попробуйте ещё раз.', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Отправить';
  }
}
byId('supportSend')?.addEventListener('click', sendSupportRequest);
byId('checkUpdates')?.addEventListener('click', () => checkUpdates());
byId('minimizeWindow').addEventListener('click', () => window.launcher.windowAction('minimize')); byId('closeWindow').addEventListener('click', () => window.launcher.windowAction('close'));
window.launcher.onLauncherUpdateProgress(d => { byId('progressWrap').hidden = false; byId('progressBar').style.width = Math.max(2, d.current || 2) + '%'; byId('progressText').textContent = d.label || 'Обновление MaoLauncher…'; });
window.launcher.onProgress(d => { byId('progressWrap').hidden = false; const pct = d.total ? Math.max(3, Math.min(100, Math.round(d.current / d.total * 100))) : 6; byId('progressBar').style.width = pct + '%'; byId('progressText').textContent = (d.label || 'Загрузка') + (d.total ? ' · ' + d.current + '/' + d.total : ''); });
window.launcher.onGameStarted(d => { gameRunning = true; renderPlayButton(); notify('Minecraft запущен: ' + d.profile); }); window.launcher.onGameClosed(d => { gameRunning = false; renderPlayButton(); if (d.code) notify('Игра завершилась с кодом ' + d.code, true); }); window.launcher.onGameLog(line => { byId('progressText').textContent = line; const entry = String(line ?? '').trim(); if (!entry) return; gameConsoleLines.push(new Date().toLocaleTimeString() + '  ' + entry); if (gameConsoleLines.length > 1500) gameConsoleLines.splice(0, gameConsoleLines.length - 1500); const consoleView = byId('gameConsole'); if (consoleView) { consoleView.textContent = gameConsoleLines.join('\n'); consoleView.scrollTop = consoleView.scrollHeight; } });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (config.theme === 'auto') render(); });
(async () => { try { config = { ...defaults, ...(await window.launcher.readSettings()) }; } catch (e) { notify(e.message, true); } render(); applyLanguage(); await refreshState(); checkServer(); setInterval(checkServer, 7000); if (config.autoUpdateChecks !== false) { checkUpdates('updateHint', true); setInterval(() => { if (config.autoUpdateChecks !== false) checkUpdates('updateHint', true); }, 30 * 60 * 1000); } loadNews(); setInterval(loadNews, 15 * 60 * 1000); setInterval(() => { if (byId('streamsview')?.classList.contains('active')) refreshTwitchStreams(); }, 180000); })();

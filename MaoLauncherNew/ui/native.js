(async()=>{
 if(!window.mao)return;
 const native=window.mao,info=await native.info();
 let profiles=Array.isArray(info.settings.profiles)?info.settings.profiles:[];
 if(info.settings.profile&&!profiles.some(p=>p.name===info.settings.profile.name))profiles.push(info.settings.profile);

 if(info.settings.profile)localStorage.setItem(profileKey,JSON.stringify(info.settings.profile));else localStorage.removeItem(profileKey);
 for(const key of Object.keys(settingsDefaults))if(typeof info.settings[key]===typeof settingsDefaults[key])preferences[key]=info.settings[key];
 memoryRange.value=memoryInput.value=preferences.memory;launchArgs.value=preferences.args;
 for(const [id,key] of [['themeSelect','theme'],['languageSelect','language'],['minimizeSelect','minimize']])document.getElementById(id).value=preferences[key];snowToggle.checked=preferences.snow;
 applyTheme();applyLanguage();applySnow();renderProfile();
 async function persist(){let profile=null;try{profile=JSON.parse(localStorage.getItem(profileKey)||'null')}catch{}await native.save({...preferences,profile,profiles})}
 const previousSave=savePreferences;savePreferences=function(){previousSave();persist().catch(e=>notify(e.message))};
 
 document.getElementById('minimize').onclick=async()=>{const animation=w.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(70px) scale(.85)'}],{duration:220,easing:'ease-in',fill:'forwards'});await animation.finished;await native.minimize();animation.cancel()};document.getElementById('close').onclick=()=>native.close();
 document.querySelectorAll('[data-i18n="version"]').forEach(el=>{if(el.parentElement)el.parentElement.lastChild.textContent=' '+info.version});
 document.querySelectorAll('.side-version').forEach(el=>el.lastElementChild.textContent=info.version);
 function updateFolder(dir){const el=document.getElementById('gameFolderPath');if(el)el.textContent=dir}
 const folderButton=document.getElementById('openGameFolder');let folderPath=document.createElement('p');folderPath.id='gameFolderPath';folderPath.style.cssText='font-size:12px;color:var(--muted);overflow-wrap:anywhere';folderButton.parentElement.after(folderPath);updateFolder(info.gameDir);
 for(const id of ['openGameFolder','changeGameFolder']){const old=document.getElementById(id);old.replaceWith(old.cloneNode(true))}
 document.getElementById('openGameFolder').onclick=()=>native.openFolder().catch(e=>notify(e.message));document.getElementById('changeGameFolder').onclick=()=>native.chooseFolder().then(updateFolder).catch(e=>notify(e.message));
 words.en.folderHelp='Game files are stored in the selected folder.';words.ru.folderHelp='Файлы игры хранятся в выбранной папке.';words.en.autosave='Settings are saved automatically.';words.ru.autosave='Настройки сохраняются автоматически.';words.ru.minimizeHelp='Выбранный способ применяется при нажатии кнопки сворачивания.';words.en.minimizeHelp='Applies when you press the minimize button.';applyLanguage();
 document.getElementById('openConsole').onclick=async()=>{document.getElementById('consoleOutput').textContent=await native.logs();consoleDialog.showModal()};
 const gameLabel=launchButton.innerHTML;let running=false;
 function resetButton(){launchButton.disabled=false;launchButton.innerHTML=gameLabel}
 function stage(text,percent){launchPanel.hidden=false;document.getElementById('launchStage').textContent=text;document.getElementById('launchPercent').textContent=percent==null?'':percent+'%';document.getElementById('launchProgressFill').style.width=(percent||0)+'%';document.getElementById('launchProgressBar').setAttribute('aria-valuenow',String(percent||0));document.getElementById('launchProgressNote').textContent='Minecraft 26.2 · Fabric · mc.maopickme.ru'}
 launchButton.onclick=async()=>{if(running)return;running=true;launchButton.disabled=true;stage('Подготовка запуска',0);try{await persist();await native.launch()}catch(e){stage('Не удалось запустить игру',null);notify(e.message);resetButton();running=false}};
 native.onEvent(data=>{if(data.type==='progress')stage(data.stage,data.percent);if(data.type==='game-start'){stage('Minecraft запущен',100);launchButton.textContent='ИГРА ЗАПУЩЕНА'}if(data.type==='game-exit'){running=false;resetButton();stage('Игра завершена',100)}if(data.type==='launch-error'){stage('Ошибка запуска — открой консоль',null);running=false;resetButton()}if(data.type==='log'){const output=document.getElementById('consoleOutput');output.textContent=(output.textContent+'\n'+data.text).slice(-80000);output.scrollTop=output.scrollHeight}if(data.type==='update'){document.getElementById('nativeUpdateStatus').textContent=data.message;if(data.ready)document.getElementById('installNativeUpdate').hidden=false}if(data.type==='addon-progress')addonMessage(data.stage+(data.percent!=null?' · '+data.percent+'%':''))});
 const about=document.getElementById('launcherSettings');const updates=document.createElement('div');updates.className='setting-card';updates.innerHTML='<p id="nativeUpdateStatus"></p><button class="settings-action" id="checkNativeUpdate">Проверить обновления</button> <button class="settings-action" id="installNativeUpdate" hidden>Установить и перезапустить</button>';about.append(updates);document.getElementById('nativeUpdateStatus').textContent=info.updateConfigured?'Обновления подключены':'Сервер обновлений будет подключён в следующем этапе.';document.getElementById('checkNativeUpdate').onclick=()=>native.checkUpdates().catch(e=>notify(e.message));document.getElementById('installNativeUpdate').onclick=()=>native.installUpdate().catch(e=>notify(e.message));

 // Keep historical cards in the document as hidden templates.
 const progress=document.getElementById('launchProgress');document.querySelector('.hero-actions').append(progress);
 const profilePage=document.getElementById('profilePage'),panel=profilePage.querySelector('.profile-panel');
 const selector=document.createElement('div');selector.className='profile-popup';selector.id='profilePopup';selector.hidden=true;document.querySelector('.sidebar-bottom').append(selector);
 const profileTrigger=document.getElementById('profileLaunch');profileTrigger.setAttribute('aria-haspopup','true');profileTrigger.setAttribute('aria-expanded','false');
 function closeProfiles(){selector.hidden=true;profileTrigger.setAttribute('aria-expanded','false')}
 profileTrigger.onclick=()=>{selector.hidden=!selector.hidden;profileTrigger.setAttribute('aria-expanded',String(!selector.hidden))};
 document.addEventListener('click',e=>{if(!selector.contains(e.target)&&!profileTrigger.contains(e.target))closeProfiles()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProfiles()});
 const footer=document.querySelector('.social-row');const column=document.createElement('div');column.className='content-column';const content=document.getElementById('content');content.before(column);column.append(content,footer);footer.classList.add('app-footer');
 const socialToggle=document.getElementById('heroSocialToggle');const socialPanel=document.getElementById('heroSocial');if(socialToggle&&socialPanel){socialToggle.onclick=()=>{const open=socialPanel.classList.toggle('is-open');socialToggle.setAttribute('aria-expanded',String(open))};socialPanel.addEventListener('keydown',e=>{if(e.key==='Escape'){socialPanel.classList.remove('is-open');socialToggle.setAttribute('aria-expanded','false');socialToggle.focus()}})}
 const deleteDialog=document.createElement('dialog');deleteDialog.className='delete-dialog';deleteDialog.innerHTML='<h2>Удалить профиль?</h2><p id="deleteProfileMessage"></p><p>Файлы игры останутся на компьютере.</p><form method="dialog" class="delete-actions"><button value="cancel" autofocus>Отмена</button><button value="delete" class="danger">Удалить</button></form>';document.body.append(deleteDialog);
 function confirmDeleteProfile(name){return new Promise(resolve=>{document.getElementById('deleteProfileMessage').textContent='Профиль «'+name+'» будет удалён из лаунчера.';deleteDialog.returnValue='cancel';deleteDialog.addEventListener('close',()=>resolve(deleteDialog.returnValue==='delete'),{once:true});deleteDialog.showModal()})}
 const snowHosts=document.querySelectorAll('.hero,.content-inner,.settings-box,.profile-panel,.support-form,#newsPage');for(const host of snowHosts){host.classList.add('snow-host');const layer=document.createElement('div');layer.className='panel-snow';layer.setAttribute('aria-hidden','true');for(let i=0;i<14;i++){const flake=document.createElement('span');flake.className='snow-flake';flake.textContent='❄';flake.style.cssText=`left:${(i*37.3)%100}%;font-size:${9+i%7}px;animation:launcherSnowfall ${9+i%8}s linear infinite;animation-delay:-${i%13}s`;layer.append(flake)}host.append(layer)}const oldSnow=applySnow;applySnow=function(){oldSnow();document.querySelectorAll('.panel-snow').forEach(layer=>layer.hidden=!preferences.snow)};applySnow();
 function selected(){try{return JSON.parse(localStorage.getItem(profileKey)||'null')}catch{return null}}
 function newProfile(){closeProfiles();showProfile();document.querySelector('[data-mode="offline"]').click();document.getElementById('offlineForm').reset();document.getElementById('profileError').textContent='';showFaceHint('Введи ник для просмотра скина');document.getElementById('nickname').focus()}
 function renderProfiles(){selector.replaceChildren();const title=document.createElement('h2');title.textContent='Мои профили';selector.append(title);for(const p of profiles){const row=document.createElement('div');row.className='profile-row';const button=document.createElement('button');button.className='profile-choice';button.type='button';button.setAttribute('aria-pressed',String(selected()?.name===p.name));const avatar=document.createElement('img');avatar.src='https://mc-heads.net/avatar/'+encodeURIComponent(p.name)+'/64';avatar.alt='';const label=document.createElement('span');label.textContent=p.name;const status=document.createElement('small');status.textContent='Оффлайн';label.append(status);button.append(avatar,label);button.onclick=async()=>{localStorage.setItem(profileKey,JSON.stringify(p));renderProfile();renderProfiles();closeProfiles();try{await persist();notify('Выбран профиль '+p.name)}catch(e){notify(e.message)}};const remove=document.createElement('button');remove.className='profile-delete';remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Удалить профиль '+p.name);remove.onclick=async()=>{if(running){notify('Дождись завершения игры или загрузки');return}if(!await confirmDeleteProfile(p.name))return;profiles=profiles.filter(item=>item.name!==p.name);if(selected()?.name===p.name){if(profiles.length)localStorage.setItem(profileKey,JSON.stringify(profiles[0]));else localStorage.removeItem(profileKey);renderProfile()}renderProfiles();await persist();notify('Профиль удалён')};row.append(button,remove);selector.append(row)}const add=document.createElement('button');add.type='button';add.className='profile-create';add.textContent='+ Создать новый';add.onclick=newProfile;selector.append(add)}
 document.getElementById('offlineForm').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('nickname'),error=document.getElementById('profileError');if(!input.checkValidity()){input.reportValidity();return}const profile={name:input.value.trim(),type:'offline'};if(profiles.some(p=>p.name.toLowerCase()===profile.name.toLowerCase())){error.textContent='Профиль с таким ником уже есть. Выбери его в списке.';return}if(profiles.length>=100){error.textContent='Можно сохранить до 100 профилей.';return}profiles.push(profile);localStorage.setItem(profileKey,JSON.stringify(profile));renderProfile();renderProfiles();error.textContent='';try{await persist();notify('Профиль создан')}catch(e){notify(e.message)}};
 document.querySelector('.profile-note').textContent='Профили сохраняются на этом компьютере. Ник: 3–16 латинских букв, цифр или подчёркивание.';
 let skinRequest=0,skinTimer;const skinPreview=document.getElementById('skinPreview');function showFaceHint(text){skinPreview.replaceChildren();const hint=document.createElement('span');hint.className='skin-placeholder';hint.textContent=text;skinPreview.append(hint)}
 document.getElementById('nickname').addEventListener('input',()=>{clearTimeout(skinTimer);const request=++skinRequest,name=document.getElementById('nickname').value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(name)){showFaceHint('Введи ник для просмотра скина');return}showFaceHint('Поиск скина…');skinTimer=setTimeout(async()=>{const face=await native.skinFace(name);if(request!==skinRequest)return;if(!face){showFaceHint('Лицензионный скин не найден');return}const img=document.createElement('img');img.alt='Лицо скина '+name;img.src=face;skinPreview.replaceChildren(img)},500)});
 renderProfiles();
 const mapFrame=document.getElementById('serverMapFrame');function loadMap(){if(!mapFrame.src)mapFrame.src=mapFrame.dataset.src}document.querySelector('[data-page="map"]').addEventListener('click',loadMap);document.getElementById('mapRefresh').onclick=()=>{loadMap();mapFrame.src=mapFrame.dataset.src};
 let pingBusy=false,pingMs=null;function renderPing(){const el=document.getElementById('serverPing');el.replaceChildren();el.textContent=pingMs==null?'—':String(pingMs);if(pingMs!==null){const unit=document.createElement('small');unit.textContent=preferences.language==='en'?' ms':' мс';el.append(unit)}el.title='Пинг от этого компьютера до mc.maopickme.ru (Minecraft Status Ping)'}
 const previousRenderState=renderServerState;renderServerState=function(){previousRenderState();renderPing()};async function refreshPing(){if(pingBusy||document.hidden)return;pingBusy=true;try{const r=await native.ping();pingMs=Number.isFinite(r.ms)?r.ms:null}catch{pingMs=null}finally{pingBusy=false;renderPing()}}refreshPing();setInterval(refreshPing,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPing()});

 // Add-ons catalogue: Modrinth-backed mods, resource packs and shaders.
 const addonGrid=document.getElementById('addonsGrid'),addonStatus=document.getElementById('addonsStatus'),addonSearch=document.getElementById('addonsSearch');
 let addonCategory='resourcepack',addonRequest=0;
 const addonLabels={resourcepack:'ресурс-паки',mod:'моды',shader:'шейдеры'};
 function addonMessage(message){addonStatus.textContent=message}
 function addonEmpty(message){addonGrid.replaceChildren();const box=document.createElement('div');box.className='addons-empty';box.textContent=message;addonGrid.append(box)}
 function renderAddonCards(items){
   addonGrid.replaceChildren();
   if(!items.length){addonEmpty('Ничего не найдено. Попробуй изменить поисковый запрос.');return}
   for(const item of items){
     const card=document.createElement('article');card.className='addon-card';
     const icon=document.createElement('div');icon.className='addon-icon';
     if(item.icon){const img=document.createElement('img');img.src=item.icon;img.alt='';img.loading='lazy';img.onerror=()=>{img.remove();icon.textContent='✦'};icon.append(img)}else icon.textContent='✦';
     const copy=document.createElement('div');copy.className='addon-copy';
     const title=document.createElement('h3');title.textContent=item.title;
     const description=document.createElement('p');description.textContent=item.description||'Описание не добавлено.';
     const meta=document.createElement('div');meta.className='addon-meta';meta.textContent=(item.author?'Автор: '+item.author+' · ':'')+new Intl.NumberFormat('ru-RU',{notation:'compact'}).format(item.downloads)+' загрузок';
     const actions=document.createElement('div');actions.className='addon-actions';
     const source=document.createElement('span');source.textContent='Minecraft 26.2'+(addonCategory==='mod'?' · Fabric':'');
     const install=document.createElement('button');install.type='button';install.className='addon-install';install.textContent='Установить';
     install.onclick=async()=>{install.disabled=true;install.textContent='Загрузка…';addonMessage('Устанавливаем «'+item.title+'»…');try{const result=await native.installAddon(addonCategory,item.id);install.textContent='Установлено';addonMessage('«'+item.title+'» установлено в папку '+result.folder+'.')}catch(e){install.disabled=false;install.textContent='Повторить';addonMessage(e.message);notify(e.message)}};
     actions.append(source,install);copy.append(title,description,meta,actions);card.append(icon,copy);addonGrid.append(card);
   }
 }
 async function loadAddons(){
   const request=++addonRequest,query=addonSearch.value.trim();
   if(addonCategory==='skin'){addonMessage('Скины игроков');addonGrid.replaceChildren();const note=document.createElement('div');note.className='addons-skin-note';const strong=document.createElement('strong');strong.textContent='Скины Minecraft';const p=document.createElement('p');p.textContent='Скины привязываются к аккаунту Minecraft и не устанавливаются как моды или ресурс-паки. Для офлайн-профиля можно посмотреть скин по никнейму при создании профиля. Подключение выбора и применения скинов из каталога добавим отдельно.';note.append(strong,p);addonGrid.append(note);return}
   addonMessage(query?'Поиск: '+query:'Загружаем '+addonLabels[addonCategory]+'…');addonEmpty('Загружаем каталог…');
   try{const items=await native.searchAddons(addonCategory,query);if(request!==addonRequest)return;renderAddonCards(items);addonMessage('Найдено: '+items.length+' · Совместимость: Minecraft 26.2'+(addonCategory==='mod'?' / Fabric':''))}catch(e){if(request!==addonRequest)return;addonEmpty('Не удалось загрузить каталог. Проверь подключение к интернету и попробуй ещё раз.');addonMessage(e.message)}
 }
 document.querySelectorAll('[data-addon-category]').forEach(button=>button.addEventListener('click',()=>{addonCategory=button.dataset.addonCategory;document.querySelectorAll('[data-addon-category]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});loadAddons()}));
 document.getElementById('addonsSearchButton').onclick=loadAddons;
 addonSearch.addEventListener('keydown',e=>{if(e.key==='Enter')loadAddons()});
 addonSearch.addEventListener('search',loadAddons);
 loadAddons();
 await persist();
})().catch(e=>{console.error(e);if(typeof notify==='function')notify('Ошибка подключения функций приложения: '+e.message)});

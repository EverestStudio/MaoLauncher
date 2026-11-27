(async()=>{
 if(!window.mao)return;
 const native=window.mao;
 let info={version:'',settings:{}};
 try{info=await native.info()||info}catch(error){notify('Не удалось прочитать настройки лаунчера: '+error.message)}
 info.settings=info.settings&&typeof info.settings==='object'?info.settings:{};
 const appVersion=String(info.appVersion||info.version||'—');
 let profiles=Array.isArray(info.settings.profiles)?info.settings.profiles:[];
 if(info.settings.profile&&!profiles.some(p=>p.name===info.settings.profile.name))profiles.push(info.settings.profile);

 if(info.settings.profile)localStorage.setItem(profileKey,JSON.stringify(info.settings.profile));else localStorage.removeItem(profileKey);
 for(const key of Object.keys(settingsDefaults))if(typeof info.settings[key]===typeof settingsDefaults[key])preferences[key]=info.settings[key];
 memoryRange.value=memoryInput.value=preferences.memory;launchArgs.value=preferences.args;
 for(const [id,key] of [['themeSelect','theme'],['languageSelect','language'],['minimizeSelect','minimize']])document.getElementById(id).value=preferences[key];snowToggle.checked=preferences.snow;
 applyTheme();applyLanguage();applySnow();renderProfile();
 async function persist(){let profile=null;try{profile=JSON.parse(localStorage.getItem(profileKey)||'null')}catch{}await native.save({...preferences,sidebarCollapsed,profile,profiles})}
 if(typeof info.settings.sidebarCollapsed==='boolean'){sidebarCollapsed=info.settings.sidebarCollapsed;applySidebar()}
 document.getElementById('sidebarToggle').addEventListener('click',()=>persist().catch(e=>notify(e.message)));
 const previousSaveSidebar=true;const previousSave=savePreferences;savePreferences=function(){previousSave();persist().catch(e=>notify(e.message))};
 
 document.getElementById('minimize').onclick=async()=>{try{await persist();await native.minimize()}catch(e){notify(e.message)}};document.getElementById('close').onclick=()=>native.close();
 const launcherVersionValue=document.getElementById('launcherVersionValue');if(launcherVersionValue)launcherVersionValue.textContent=appVersion;
 document.querySelectorAll('.side-version').forEach(el=>el.lastElementChild.textContent=appVersion);
 function updateFolder(dir){const value=String(dir||'');const el=document.getElementById('gameFolderPath');if(el)el.textContent=value;const input=document.getElementById('gameDirectory');if(input)input.value=value}
 updateFolder(info.gameDir);
 for(const id of ['openGameFolder','changeGameFolder']){const old=document.getElementById(id);old.replaceWith(old.cloneNode(true))}
 document.getElementById('openGameFolder').onclick=()=>native.openFolder().catch(e=>notify('Не удалось открыть папку игры: '+e.message));document.getElementById('changeGameFolder').onclick=()=>native.chooseFolder().then(dir=>{updateFolder(dir);return persist()}).catch(e=>notify('Не удалось изменить папку игры: '+e.message));
 words.en.folderHelp='Game files are stored in the selected folder.';words.ru.folderHelp='Файлы игры хранятся в выбранной папке.';words.en.autosave='Settings are saved automatically.';words.ru.autosave='Настройки сохраняются автоматически.';words.ru.minimizeHelp='Выбранный способ применяется при нажатии кнопки сворачивания.';words.en.minimizeHelp='Applies when you press the minimize button.';applyLanguage();
 document.getElementById('openConsole').onclick=async()=>{const output=document.getElementById('consoleOutput');output.textContent=await native.logs();consoleDialog.showModal();output.scrollTop=output.scrollHeight};
 const gameLabel=launchButton.innerHTML;let running=false;
 function resetButton(){launchButton.disabled=false;launchButton.innerHTML=gameLabel}
 function stage(text,percent){launchPanel.hidden=false;document.getElementById('launchStage').textContent=text;document.getElementById('launchPercent').textContent=percent==null?'':percent+'%';document.getElementById('launchProgressFill').style.width=(percent||0)+'%';document.getElementById('launchProgressBar').setAttribute('aria-valuenow',String(percent||0));document.getElementById('launchProgressNote').textContent='Minecraft 26.2 · Fabric · mc.maopickme.ru'}
 launchButton.onclick=async()=>{if(running)return;running=true;launchButton.disabled=true;stage('Подготовка запуска',0);try{await persist();await native.launch()}catch(e){stage('Не удалось запустить игру',null);notify(e.message);resetButton();running=false}};
 native.onEvent(data=>{if(data.type==='progress')stage(data.stage,data.percent);if(data.type==='game-start'){launchPanel.hidden=true;launchButton.textContent='ИГРА ЗАПУЩЕНА'}if(data.type==='game-exit'){running=false;resetButton();launchPanel.hidden=true}if(data.type==='launch-error'){stage('Ошибка запуска — открой консоль',null);running=false;resetButton()}if(data.type==='log'){const output=document.getElementById('consoleOutput');output.textContent=(output.textContent+'\n'+data.text).slice(-80000);output.scrollTop=output.scrollHeight}if(data.type==='addon-progress')addonMessage(data.stage+(data.percent!=null?' · '+data.percent+'%':''))});


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
 const profileNote=document.querySelector('.profile-note');if(profileNote)profileNote.textContent='Ник: 3–16 латинских букв, цифр или подчёркивание.';
 let skinRequest=0,skinTimer;const skinPreview=document.getElementById('skinPreview');function showFaceHint(text){skinPreview.replaceChildren();const hint=document.createElement('span');hint.className='skin-placeholder';hint.textContent=text;skinPreview.append(hint)}
 window.dispatchEvent(new Event('mao-skin-ready'));
 renderProfiles();
 const mapFrame=document.getElementById('serverMapFrame'),mapUrl='http://135.181.126.154:25602/';function loadMap(){if(!mapFrame.getAttribute('src'))mapFrame.src=mapUrl}document.querySelector('[data-page="map"]').addEventListener('click',loadMap);document.getElementById('mapRefresh').onclick=()=>{mapFrame.src=mapUrl+'?refresh='+Date.now()};


 // Add-ons catalogue: Modrinth-backed mods, resource packs and shaders.
 const addonGrid=document.getElementById('addonsGrid'),addonStatus=document.getElementById('addonsStatus'),addonSearch=document.getElementById('addonsSearch');
 let addonCategory='resourcepack',addonRequest=0;let installedAddons={};
 const addonLabels={resourcepack:'ресурс-паки',mod:'моды',shader:'шейдеры'};
 function addonMessage(message){addonStatus.textContent=message}
 function addonEmpty(message){addonGrid.replaceChildren();const box=document.createElement('div');box.className='addons-empty';box.textContent=message;addonGrid.append(box)}
 function renderAddonCards(items){
   addonGrid.replaceChildren();
   if(!items.length){addonEmpty('Ничего не найдено. Попробуй изменить поисковый запрос.');return}
   const category=addonCategory;
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
     const key=category+':'+item.id;function updateAction(){install.disabled=false;install.textContent=installedAddons[key]?'Удалить':'Установить';install.classList.toggle('is-installed',!!installedAddons[key])}updateAction();
     install.onclick=async()=>{const removing=!!installedAddons[key];install.disabled=true;install.textContent=removing?'Удаление…':'Загрузка…';try{if(removing){await native.removeAddon(category,item.id);delete installedAddons[key];addonMessage('«'+item.title+'» удалено.')}else{const result=await native.installAddon(category,item.id);installedAddons[key]=result;addonMessage('«'+item.title+'» установлено в папку '+result.folder+'.')}}catch(e){addonMessage(e.message);notify(e.message)}finally{updateAction()}};
     actions.append(source,install);copy.append(title,description,meta,actions);card.append(icon,copy);addonGrid.append(card);
   }
 }
 const pagination=document.createElement('nav');pagination.className='addons-pagination';pagination.setAttribute('aria-label','Страницы дополнений');pagination.hidden=true;addonGrid.after(pagination);
 let addonPage=1,addonPages=1;
 function renderPagination(){
   pagination.replaceChildren();pagination.hidden=addonPages<2;if(pagination.hidden)return;
   const add=(label,page,disabled=false)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.setAttribute('aria-label',/^\d+$/.test(label)?'Страница '+label:label);if(page===addonPage&&/^\d+$/.test(label))button.setAttribute('aria-current','page');button.onclick=()=>loadAddons(page,true);pagination.append(button)};
   add('Назад',addonPage-1,addonPage===1);
   const pages=[...new Set([1,addonPages,addonPage-1,addonPage,addonPage+1].filter(n=>n>=1&&n<=addonPages))].sort((a,b)=>a-b);
   let previous=0;for(const page of pages){if(previous&&page-previous>1){const gap=document.createElement('span');gap.textContent='…';pagination.append(gap)}add(String(page),page);previous=page}
   add('Вперёд',addonPage+1,addonPage===addonPages);
 }
 function renderInstalled(){
   addonGrid.replaceChildren();
   const table=document.createElement('div');table.className='installed-columns';table.setAttribute('aria-label','Установленные дополнения');
   const query=addonSearch.value.trim().toLocaleLowerCase('ru');let count=0;
   for(const [type,title] of [['mod','Моды'],['shader','Шейдеры'],['resourcepack','Ресурс-паки']]){
     const column=document.createElement('section');column.className='installed-column';const heading=document.createElement('h2');heading.textContent=title;column.append(heading);
     const list=document.createElement('ul');column.append(list);
     const entries=Object.values(installedAddons).filter(item=>item.type===type&&(!query||(String(item.title||'')+' '+item.filename).toLocaleLowerCase('ru').includes(query))).sort((a,b)=>String(a.title||a.filename).localeCompare(String(b.title||b.filename),'ru'));
     count+=entries.length;
     for(const item of entries){
       const row=document.createElement('li');const text=document.createElement('div');const name=document.createElement('strong');name.textContent=item.title||item.filename;const file=document.createElement('small');file.textContent=item.filename;file.title=item.filename;text.append(name,file);
       const remove=document.createElement('button');remove.type='button';remove.className='addon-install is-installed';remove.textContent='Удалить';remove.setAttribute('aria-label','Удалить '+(item.title||item.filename));
       remove.onclick=async()=>{remove.disabled=true;remove.textContent='Удаление…';try{await native.removeAddon(item.type,item.projectId);installedAddons=await native.listAddons();if(addonCategory==='installed'){renderInstalled();addonMessage('Удалено: '+(item.title||item.filename))}}catch(e){addonMessage(e.message);notify(e.message)}finally{remove.disabled=false;remove.textContent='Удалить'}};
       row.append(text,remove);list.append(row);
     }
     if(!entries.length){const empty=document.createElement('li');empty.className='installed-empty';empty.textContent=query?'Ничего не найдено':'Пока ничего не установлено';list.append(empty)}
     table.append(column);
   }
   addonGrid.append(table);addonMessage('Установлено: '+count+(query?' · Поиск: '+addonSearch.value.trim():''));
 }
 async function loadAddons(page=1,scroll=false){
   const request=++addonRequest,query=addonSearch.value.trim(),category=addonCategory;
   addonPage=Number.isInteger(page)&&page>0?page:1;pagination.hidden=true;pagination.replaceChildren();addonGrid.setAttribute('aria-busy','true');
   try{
     if(category==='installed'){addonEmpty('Загружаем установленные дополнения…');installedAddons=await native.listAddons();if(request!==addonRequest)return;renderInstalled();return}
     if(category==='skin'){addonMessage('Скины игроков');addonGrid.replaceChildren();const note=document.createElement('div');note.className='addons-skin-note';note.textContent='Скины привязываются к аккаунту Minecraft. Предпросмотр скина по никнейму доступен при создании профиля. Каталог скинов пока в разработке.';addonGrid.append(note);return}
     addonMessage(query?'Поиск: '+query:'Загружаем '+addonLabels[category]+'…');addonEmpty('Загружаем каталог…');
     const [result,installed]=await Promise.all([native.searchAddons(category,query,addonPage),native.listAddons()]);if(request!==addonRequest)return;
     installedAddons=installed;addonPages=Math.max(1,Math.ceil(result.total/result.pageSize));
     if(addonPage>addonPages){await loadAddons(addonPages,scroll);return}
     renderAddonCards(result.items);renderPagination();addonMessage('Найдено: '+result.total+' · Страница '+addonPage+' из '+addonPages+' · Minecraft 26.2'+(category==='mod'?' / Fabric':''));
     if(scroll)document.getElementById('addonsPage').scrollIntoView({block:'start',behavior:'instant'});
   }catch(e){if(request!==addonRequest)return;addonEmpty('Не удалось загрузить каталог. Проверь подключение и попробуй ещё раз.');addonMessage(e.message)}finally{if(request===addonRequest)addonGrid.setAttribute('aria-busy','false')}
 }
 document.querySelectorAll('[data-addon-category]').forEach(button=>button.addEventListener('click',()=>{addonCategory=button.dataset.addonCategory;document.querySelectorAll('[data-addon-category]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});loadAddons(1)}));
 document.getElementById('addonsSearchButton').onclick=()=>loadAddons(1);
 addonSearch.addEventListener('keydown',e=>{if(e.key==='Enter')loadAddons(1)});
 addonSearch.addEventListener('search',()=>loadAddons(1));
 loadAddons();
 await persist();
})().catch(e=>{console.error(e);if(typeof notify==='function')notify('Ошибка подключения функций приложения: '+e.message)});

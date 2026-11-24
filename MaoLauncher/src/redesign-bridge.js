(()=> {
'use strict';
const $=id=>document.getElementById(id);
const legacy=id=>$('legacy-'+id)||$(id);
const legacyRoot=$('legacyLauncher');
const pageIds={home:'homePage',news:'newsPage',map:'mapPage',support:'supportPage',settings:'settingsPage'};
function showPage(key){
 const target=pageIds[key];
 if(!target&&key!=='profile')return;
 for(const id of Object.values(pageIds))$(id).hidden=id!==target;
 $('profilePage').hidden=key!=='profile';
 $('content').scrollTo({top:0,behavior:'smooth'});
 document.querySelectorAll('#launcherSidebar [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===key));
}
document.querySelectorAll('#launcherSidebar [data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
$('profileLaunch').addEventListener('click',()=>showPage('profile'));
$('play').addEventListener('click',()=> $('playButton').click());
$('minimize').addEventListener('click',()=> $('minimizeWindow').click());
$('close').addEventListener('click',()=> $('closeWindow').click());
$('mapRefresh').addEventListener('click',()=>{const f=$('redesignWorldMap');f.src='http://135.181.126.154:25602/?refresh='+Date.now()});
$('redesignSidebarToggle').addEventListener('click',()=> $('sidebarToggle').click());
$('redesignOfflineForm').addEventListener('submit',e=>{
 e.preventDefault();
 const name=$('nickname').value.trim(),field=$('profileName');
 field.value=name;
 $('offlineChoice').click();
 $('addProfile').click();
});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
 const account=b.dataset.mode==='account';
 $('redesignOfflineForm').hidden=account;
 $('accountForm').hidden=!account;
 if(account)$('accountStatus').textContent='Вход Ely.by в текущей версии не подключён. Используйте офлайн-профиль.';
}));
const supportWatch=new MutationObserver(()=>{$('supportStatus').textContent=$('supportFormHint').textContent});
supportWatch.observe($('supportFormHint'),{childList:true,subtree:true,characterData:true});
$('supportForm').addEventListener('submit',e=>{
 e.preventDefault();
 $('supportSubject').value=$('supportTitle').value;
 $('supportMessage').value=$('supportDescription').value;
 $('supportSend').click();
});
const syncPairs=[
 ['memoryRange','memorySetting','input'],['memoryInput','memoryManual','change'],
 ['launchArgs','launchArgumentsSetting','change'],['themeSelect','themeSetting','change'],
 ['languageSelect','languageSetting','change'],['minimizeSelect','minimizeBehavior','change'],
 ['snowToggle','snowfallSetting','change']
];
for(const [from,to,eventName] of syncPairs){
 const a=$(from),b=$(to); if(!a||!b)continue;
 const sync=()=>{b.value=a.value;if(a.type==='checkbox')b.checked=a.checked;b.dispatchEvent(new Event(eventName,{bubbles:true}))};
 a.addEventListener(eventName==='input'?'input':'change',sync);
}
$('openGameFolder').addEventListener('click',()=> $('openFolder').click());
$('redesignChangeGameFolder').addEventListener('click',()=> $('changeGameFolder').click());
$('openConsole').addEventListener('click',()=>{$('consoleOutput').textContent=$('gameConsole').textContent;$('launcherConsole').showModal()});
new MutationObserver(()=>{if($('launcherConsole').open)$('consoleOutput').textContent=$('gameConsole').textContent}).observe($('gameConsole'),{childList:true,characterData:true,subtree:true});
const newName=$('redesignProfileName'),avatar=$('profileAvatar'),profileButton=document.querySelector('#legacyLauncher .profileDockMount .profileNav');
const syncProfile=()=>{
 const name=profileButton?.querySelector('.profileNickname')?.textContent?.trim()||'';
 const type=profileButton?.querySelector('.profileType')?.textContent?.trim()||'';
 newName.textContent=name||'Создать профиль';$('profileStatus').textContent=name?type:'Не выбран';
 const image=profileButton?.querySelector('.profileButtonAvatar');
 if(image?.src)avatar.src=image.src;else avatar.removeAttribute('src');
};
new MutationObserver(syncProfile).observe(profileButton,{childList:true,subtree:true,attributes:true});
const serverPairs=[['serverStatus','serverPlayers'],['serverStatusDot','serverPing'],['serverClientVersion','serverTps']];
function syncServer(){
 const oldStatus=$('serverStatus'),oldPlayers=$('players'),oldPing=$('ping'),oldVersion=$('gameVersion');
 $('serverPlayers').textContent=oldPlayers.textContent;
 $('serverClientVersion').textContent=oldVersion.textContent;
 $('serverPing').textContent=oldPing.textContent;
 $('serverStatusDot').dataset.state=/онлайн|online/i.test(oldStatus.textContent)?'online':/недоступ|ошиб|offline/i.test(oldStatus.textContent)?'offline':'loading';
 $('serverStatusDot').title=oldStatus.textContent;
}
new MutationObserver(syncServer).observe(legacyRoot,{subtree:true,childList:true,characterData:true,attributes:true});
const progressObserver=new MutationObserver(()=>{
 const wrap=$('progressWrap'),panel=$('launchProgress');
 panel.hidden=wrap.hidden;
 $('launchProgressFill').style.width=$('progressBar').style.width;
 $('launchPercent').textContent=$('progressBar').style.width||'0%';
 $('launchStage').textContent=$('progressText').textContent;
 $('launchProgressNote').textContent=$('progressText').textContent;
});
progressObserver.observe($('progressWrap'),{attributes:true});
progressObserver.observe($('progressBar'),{attributes:true});
new MutationObserver(()=>{if($('playButton').disabled)$('play').disabled=true;else $('play').disabled=false;$('play').querySelector('span').textContent=$('playButton').textContent.includes('Играть')?'▶':'↻'}).observe($('playButton'),{attributes:true,childList:true,characterData:true});
const liveList=$('liveStreams'),visibleStreams=document.querySelector('#homePage .streams');
function syncStreams(){
 const cards=[...liveList.querySelectorAll('.liveStreamCard')];
 if(!cards.length){visibleStreams.textContent='Сейчас нет активных трансляций.';return}
 visibleStreams.replaceChildren(...cards.map(card=>{
  const button=document.createElement('button');button.type='button';button.className='stream';button.style.cssText='width:100%;text-align:left;cursor:pointer';
  const title=document.createElement('div');title.className='stream-thumb';title.textContent='▶';
  const info=document.createElement('div'),live=document.createElement('div'),name=document.createElement('div'),meta=document.createElement('div');
  live.className='live';live.textContent='LIVE';name.className='stream-name';name.textContent=card.querySelector('strong')?.textContent||'Трансляция';
  meta.className='stream-meta';meta.textContent=card.querySelector('small')?.textContent||'';
  info.append(live,name,meta);button.append(title,info);
  button.addEventListener('click',()=>card.click());return button;
 }));
}
new MutationObserver(syncStreams).observe(liveList,{subtree:true,childList:true,characterData:true});
$('refreshTwitchStreams').click();setInterval(()=>$('refreshTwitchStreams').click(),180000);
const legacyNews=$('homeNews'),legacyAllNews=$('allNews');
const newsList=document.querySelector('#homePage .news-list'),newsGrid=document.querySelector('#newsPage .news-grid');
function makeVisibleNewsCard(item,index,compact=false){
 const article=document.createElement('article');article.className=compact?'news':'news-card';
 const cover=item.querySelector('.newsCover img');
 if(cover){const image=document.createElement('img');image.src=cover.src;image.alt='';image.className='news-card-cover';article.append(image)}
 const content=document.createElement('div'),heading=document.createElement(compact?'h3':'h2'),description=document.createElement('p');
 heading.textContent=item.querySelector('h3,h2')?.textContent||'Новости MaoPickMe';
 const body=item.querySelector('.newsBody');
 const tag=item.querySelector('.tag');
 if(!compact&&tag){const label=document.createElement('span');label.className='news-tag';label.textContent=tag.textContent;content.append(label)}
 description.textContent=body?.textContent||item.querySelector('p')?.textContent||'';
 content.append(heading);if(description.textContent)content.append(description);
 article.append(content);
 if(compact){
  const date=document.createElement('div');date.className='news-date';date.textContent='NEWS';article.prepend(date);
  const homeItem=legacyNews.querySelectorAll('[data-home-news-index]')[index];
  if(homeItem){article.tabIndex=0;article.setAttribute('role','button');article.addEventListener('click',()=>homeItem.click());article.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();homeItem.click()}})}
 }
 return article;
}
function syncNews(){
 const homeItems=[...legacyNews.querySelectorAll('.newsCard,[data-home-news-index],.newsEmpty')];
 const allItems=[...legacyAllNews.querySelectorAll('.newsCard,.newsEmpty')];
 if(homeItems.length)newsList.replaceChildren(...homeItems.slice(0,3).map((item,index)=>makeVisibleNewsCard(item,index,true)));
 if(allItems.length)newsGrid.replaceChildren(...allItems.map((item,index)=>makeVisibleNewsCard(item,index,false)));
}
new MutationObserver(syncNews).observe(legacyNews,{subtree:true,childList:true,characterData:true});
new MutationObserver(syncNews).observe(legacyAllNews,{subtree:true,childList:true,characterData:true});
syncServer();syncProfile();syncNews();
$('redesignToast').setAttribute('aria-live','polite');
})();
(()=> {
'use strict';
const $=id=>document.getElementById(id);
const legacy=id=>$('legacy-'+id)||$(id);
const legacyRoot=$('legacyLauncher');
const pageIds={home:'homePage',news:'newsPage',map:'mapPage',support:'supportPage',settings:'settingsPage'};
function showPage(key){
 const target=pageIds[key];
 if(!target)return;
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
$('supportForm').addEventListener('submit',e=>{
 e.preventDefault();
 $('supportSubject').value=$('supportTitle').value;
 $('supportMessage').value=$('supportDescription').value;
 $('supportSend').click();
 const watch=new MutationObserver(()=>{$('supportStatus').textContent=$('supportFormHint').textContent});
 watch.observe($('supportFormHint'),{childList:true,subtree:true,characterData:true});
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
$('openConsole').addEventListener('click',()=>{showPage('settings');$('checkUpdates').click()});
const oldName=$('profileName'),newName=$('redesignProfileName'),avatar=$('profileAvatar');
const syncProfile=()=>{newName.textContent=oldName.value||'Создать профиль';$('profileStatus').textContent=oldName.value?'Профиль выбран':'Не выбран';if(oldName.value)avatar.src='https://mc-heads.net/avatar/'+encodeURIComponent(oldName.value)+'/64'};
new MutationObserver(syncProfile).observe(oldName,{childList:true,subtree:true,characterData:true});
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
const legacyNews=$('homeNews'),newsList=document.querySelector('#homePage .news-list');
function syncNews(){
 const items=[...legacyNews.querySelectorAll('.news')];
 if(!items.length)return;
 newsList.replaceChildren(...items.slice(0,3).map(item=>{
  const article=document.createElement('article');article.className='news';
  const copy=document.createElement('div');copy.className='news-date';copy.textContent='NEWS';
  const content=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p');
  h.textContent=item.querySelector('h3')?.textContent||'Новости MaoPickMe';
  p.textContent=item.querySelector('p')?.textContent||'';
  content.append(h,p);article.append(copy,content);return article;
 }));
}
new MutationObserver(syncNews).observe(legacyNews,{subtree:true,childList:true,characterData:true});
syncServer();syncProfile();syncNews();
$('redesignToast').setAttribute('aria-live','polite');
})();
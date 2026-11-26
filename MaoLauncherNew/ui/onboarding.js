(()=>{
'use strict';
const key='mao.onboarding.v2',q=s=>document.querySelector(s);
const steps=[
 {page:'home',target:'.hero-copy',title:'Добро пожаловать в MaoLauncher',text:'Покажем основные возможности: от первого профиля и запуска Minecraft до дополнений и настроек.'},
 {page:'home',target:'#profileLaunch',title:'Выбор профиля',text:'Кнопка внизу слева открывает список игроков. Здесь можно переключить профиль, создать новый или удалить ненужный с подтверждением.'},
 {page:'home',target:'#profilePopup',popup:true,title:'Несколько игроков в одном лаунчере',text:'Выбери сохранённый ник или нажми «Создать новый». При создании введи свой ник: для лицензионного аккаунта доступен 3D-предпросмотр скина.'},
 {page:'home',target:'#play',title:'Установка и запуск Minecraft',text:'Выбери профиль и нажми «Играть». Лаунчер подготовит Java, Fabric и файлы игры. Справа появится реальный прогресс загрузки, который скроется после запуска.'},
 {page:'home',target:'#serverStats',title:'Состояние сервера',text:'Здесь видны онлайн, версия и пинг. Если сервер не передаёт TPS, вместо выдуманного значения отображается прочерк.'},
 {page:'home',target:'.lower>section',title:'Новости на главной',text:'Здесь будут появляться объявления проекта. Если новостей ещё нет, лаунчер показывает пустое состояние.'},
 {page:'home',target:'#homeStreams',title:'Активные стримы',text:'Этот блок предназначен для текущих трансляций. Пока эфиров нет, здесь отображается соответствующая подпись.'},
 {page:'home',target:'#ourStreamers',title:'Наши стримеры',text:'Компактные карточки справа ведут на Twitch Нириски, Микани коти и Димуши. Нажми на карточку, чтобы открыть канал в браузере.'},
 {page:'home',target:'.hero-community',title:'Сайт и сообщество',text:'Иконки в правом нижнем углу баннера открывают сайт MaoPickMe, Telegram и Discord.'},
 {page:'news',target:'#newsPage',title:'Раздел новостей',text:'Отдельная страница для публикаций и обновлений проекта. Пока публикаций нет, отображается «Новостей пока нету».'},
 {page:'map',target:'.map-toolbar',title:'Онлайн-карта мира',text:'Карта открывается прямо в лаунчере. Кнопка «Обновить» перезагружает её, если данные или изображение не обновились.'},
 {page:'addons',target:'.addons-category-panel',title:'Дополнения для Minecraft',text:'Переключай категории: ресурс-паки, скины, моды и шейдеры. В подключённых каталогах доступны поиск, установка и удаление; каталог скинов пока в разработке.'},
 {page:'addons',target:'#addonsSearch',title:'Поиск и установка',text:'Найди нужное дополнение и нажми «Установить» на карточке. После установки появится «Удалить». Ресурс-паки и шейдеры нужно включить в настройках Minecraft.'},
 {page:'support',target:'#supportPage',title:'Поддержка',text:'Здесь находится форма обращения. Если отправка ещё не подключена, напиши администратору в личные сообщения и приложи лог или скриншот ошибки.'},
 {page:'settings',tab:'game',target:'#gameSettings',title:'Настройки игры',text:'Выбери папку Minecraft, объём памяти и дополнительные аргументы запуска. Здесь же можно открыть консоль. Оставляй часть оперативной памяти для Windows.'},
 {page:'settings',tab:'interface',target:'#interfaceSettings',title:'Оформление и снежинки',text:'Выбери тему и язык интерфейса, включи или выключи снежинки. Они падают на заднем плане и не перекрывают кнопки.'},
 {page:'settings',tab:'launcher',target:'#launcherSettings',title:'Поведение лаунчера',text:'Настрой сворачивание в трей или панель задач. Здесь же можно посмотреть версию и повторно пройти обучение. Настройки сохраняются автоматически.'},
 {page:'home',target:'#sidebarToggle',title:'Больше места для игры',text:'Эта кнопка сворачивает левую панель до иконок. Повторное нажатие вернёт подписи. Всё готово — приятной игры на MaoPickMe!'}
];
const layer=document.createElement('div');layer.className='tour-layer';layer.hidden=true;
layer.innerHTML='<div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-ring"></div><section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourDescription" tabindex="-1"><span class="tour-count"></span><h2 id="tourTitle"></h2><p id="tourDescription"></p><div class="tour-actions"><span></span><button class="tour-back" type="button">Назад</button><button class="tour-next" type="button">Дальше →</button></div></section>';
document.body.append(layer);
const card=q('.tour-card'),next=q('.tour-next'),back=q('.tour-back'),ring=q('.tour-ring'),shades=[...layer.querySelectorAll('.tour-shade')];
let index=0,target=null,previousFocus=null,previousPage='home',token=0,previousScroll=0;
function closeProfiles(){const popup=q('#profilePopup');if(popup)popup.hidden=true;q('#profileLaunch')?.setAttribute('aria-expanded','false')}
function place(){if(layer.hidden||!target?.isConnected)return;const r=target.getBoundingClientRect(),vw=innerWidth,vh=innerHeight,pad=6;
const x=Math.max(0,Math.min(vw,r.left-pad)),y=Math.max(0,Math.min(vh,r.top-pad)),right=Math.max(x,Math.min(vw,r.right+pad)),bottom=Math.max(y,Math.min(vh,r.bottom+pad));
[[0,0,vw,y],[0,y,x,bottom-y],[right,y,vw-right,bottom-y],[0,bottom,vw,vh-bottom]].forEach(([l,t,w,h],i)=>Object.assign(shades[i].style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'}));
Object.assign(ring.style,{left:x+'px',top:y+'px',width:right-x+'px',height:bottom-y+'px'});
const cw=card.offsetWidth,ch=card.offsetHeight,m=14,gap=16;let l=x,t=bottom+gap;
if(right+gap+cw<=vw-m){l=right+gap;t=y}else if(x-gap-cw>=m){l=x-gap-cw;t=y}else if(t+ch>vh-m){t=y-gap-ch}
Object.assign(card.style,{left:Math.max(m,Math.min(l,vw-cw-m))+'px',top:Math.max(m,Math.min(t,vh-ch-m))+'px'});
}
async function render(){const current=++token,step=steps[index];closeProfiles();q(`[data-page="${step.page}"]`)?.click();if(step.tab)q(`[data-settings-tab="${step.tab}"]`)?.click();
if(step.popup&&q('#profilePopup')?.hidden)q('#profileLaunch')?.click();
card.querySelector('h2').textContent=step.title;card.querySelector('p').textContent=step.text;q('.tour-count').textContent=`ЗНАКОМСТВО С ЛАУНЧЕРОМ · ${index+1} / ${steps.length}`;back.disabled=index===0;next.textContent=index===steps.length-1?'Готово ✓':'Дальше →';
target=q(step.target);if(!target||!target.getClientRects().length)target=q(`[data-page="${step.page}"]`);
target?.scrollIntoView({block:'nearest',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(current!==token||layer.hidden)return;place();next.focus({preventScroll:true});
}
function finish(){++token;layer.hidden=true;closeProfiles();try{localStorage.setItem(key,'done')}catch{}q(`[data-page="${previousPage}"]`)?.click();if(q('#content'))q('#content').scrollTop=previousScroll;previousFocus?.focus({preventScroll:true})}
function start(){if(!layer.hidden)return;previousFocus=document.activeElement;previousPage=q('.nav button.active')?.dataset.page||'home';previousScroll=q('#content')?.scrollTop||0;index=0;layer.hidden=false;render()}
next.onclick=()=>index===steps.length-1?finish():(index++,render());back.onclick=()=>{if(index){index--;render()}};
layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish()}else if(e.key==='Tab'){e.preventDefault();const buttons=[...card.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus()}});
window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
let attempts=0;const ready=setInterval(()=>{if(!q('#profilePopup')||!q('#ourStreamers')||!q('#launcherSettings')){if(++attempts>150)clearInterval(ready);return}clearInterval(ready);let repeat=q('#restartTour');if(!repeat){repeat=document.createElement('button');repeat.id='restartTour';repeat.type='button';repeat.className='settings-action';repeat.textContent='Пройти обучение';q('#launcherSettings').append(repeat)}repeat.onclick=start;let done=false;try{done=localStorage.getItem(key)==='done'}catch{}if(!done)setTimeout(start,500)},100);
})();

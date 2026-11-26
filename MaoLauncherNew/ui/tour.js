(()=>{
 const key='mao.onboarding.v1';
 const steps=[
  ['[data-page="home"]','Добро пожаловать в MaoLauncher','Это главная страница. Здесь собраны запуск игры и состояние сервера.'],
  ['#profileLaunch','Твои профили','Нажми сюда, чтобы выбрать игрока или создать новый профиль. Можно сохранить несколько ников и переключаться между ними.'],
  ['#serverStats','Состояние сервера','Здесь отображаются онлайн и пинг. TPS появится, когда сервер начнёт передавать эти данные.'],
  ['#play','Начать игру','Выбери профиль и нажми «Играть». Лаунчер подготовит файлы игры, а справа от кнопки покажет прогресс.'],
  ['#homeStreams','Активные стримы','Здесь появятся трансляции игроков MaoPickMe. Пока никто не ведёт эфир, отображается «Сейчас активных стримов нету».'],
  ['.hero-social','Мы в сети','Здесь собраны ссылки на Telegram, Discord и сайт проекта. Нажми на нужную площадку, чтобы открыть её.'],
  ['[data-page="map"]','Карта мира','В этом разделе можно исследовать онлайн-карту сервера прямо в лаунчере.'],
  ['[data-page="news"]','Новости проекта','Здесь будут появляться новости. Пока публикаций нет, ты увидишь соответствующую надпись.'],
  ['[data-page="support"]','Нужна помощь?','Раздел поддержки поможет найти информацию для обращения по вопросам проекта.'],
  ['[data-page="settings"]','Настрой под себя','Здесь можно выбрать папку игры, объём памяти и оформление. Повторить это обучение можно во вкладке «О лаунчере».']
 ];
 const layer=document.createElement('div');layer.className='tour-layer';layer.hidden=true;
 layer.innerHTML='<div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-ring"></div><section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourDescription" tabindex="-1"><span class="tour-count"></span><h2 id="tourTitle"></h2><p id="tourDescription"></p><div class="tour-actions"><span></span><button class="tour-back" type="button">Назад</button><button class="tour-next" type="button">Дальше →</button></div></section>';
 document.body.append(layer);
 const card=layer.querySelector('.tour-card'),next=layer.querySelector('.tour-next'),back=layer.querySelector('.tour-back'),ring=layer.querySelector('.tour-ring'),shades=[...layer.querySelectorAll('.tour-shade')];let index=0,previousFocus;
 const repeat=document.createElement('button');repeat.type='button';repeat.className='settings-action';repeat.id='restartTour';repeat.textContent='Пройти обучение';document.getElementById('launcherSettings').append(repeat);
 function place(){if(layer.hidden)return;const target=document.querySelector(steps[index][0]);const r=target.getBoundingClientRect(),vw=innerWidth,vh=innerHeight,pad=7;
  const x=Math.max(0,r.left-pad),y=Math.max(0,r.top-pad),right=Math.min(vw,r.right+pad),bottom=Math.min(vh,r.bottom+pad);
  const rects=[[0,0,vw,y],[0,y,x,bottom-y],[right,y,vw-right,bottom-y],[0,bottom,vw,vh-bottom]];
  shades.forEach((el,i)=>{const [l,t,w,h]=rects[i];Object.assign(el.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'})});
  Object.assign(ring.style,{left:x+'px',top:y+'px',width:(right-x)+'px',height:(bottom-y)+'px'});
  const cw=card.offsetWidth,ch=card.offsetHeight,gap=20,margin=16;let left,top;
  if(right+gap+cw<=vw-margin){left=right+gap;top=y+(bottom-y-ch)/2}
  else if(x-gap-cw>=margin){left=x-gap-cw;top=y+(bottom-y-ch)/2}
  else if(bottom+gap+ch<=vh-margin){left=x+(right-x-cw)/2;top=bottom+gap}
  else {left=x+(right-x-cw)/2;top=y-gap-ch}
  Object.assign(card.style,{left:Math.max(margin,Math.min(left,vw-cw-margin))+'px',top:Math.max(margin,Math.min(top,vh-ch-margin))+'px'});
 }
 function render(){const step=steps[index];layer.querySelector('.tour-count').textContent=`ЗНАКОМСТВО С ЛАУНЧЕРОМ · ${index+1} / ${steps.length}`;card.querySelector('h2').textContent=step[1];card.querySelector('p').textContent=step[2];back.disabled=index===0;next.textContent=index===steps.length-1?'Готово ✓':'Дальше →';document.querySelector(step[0]).scrollIntoView({block:'nearest'});place();next.focus()}
 function finish(){layer.hidden=true;localStorage.setItem(key,'done');window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);previousFocus?.focus()}
 function start(){if(!layer.hidden)return;previousFocus=document.activeElement;document.querySelector('[data-page="home"]').click();index=0;layer.hidden=false;window.addEventListener('resize',place);document.addEventListener('scroll',place,true);render()}
 next.onclick=()=>{if(index===steps.length-1)finish();else{index++;render()}};back.onclick=()=>{if(index>0){index--;render()}};repeat.onclick=start;
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish()}else if(e.key==='Tab'){const controls=[...card.querySelectorAll('button:not(:disabled)')];const pos=controls.indexOf(document.activeElement);e.preventDefault();controls[(pos+(e.shiftKey?-1:1)+controls.length)%controls.length].focus()}});
 window.addEventListener('load',()=>{if(!localStorage.getItem(key))setTimeout(start,800)});
})();

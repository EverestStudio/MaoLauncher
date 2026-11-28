(()=>{
const own=document.getElementById('ourStreamers'),live=document.getElementById('homeStreams');
if(own&&live&&!document.querySelector('.community-column')){const column=document.createElement('div');column.className='community-column';live.before(column);column.append(live,own)}
const layout=document.createElement('style');layout.textContent=`
#homePage .lower{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,340px);gap:24px;align-items:start}
.community-column{min-width:0;justify-self:end;width:100%}#ourStreamers{margin-top:20px}
#ourStreamers .creator-list{display:flex;flex-direction:column;gap:8px}
#ourStreamers .creator-card{padding:9px 12px;gap:10px;min-height:60px}
#ourStreamers .creator-avatar{width:38px;height:38px}#ourStreamers .creator-info p{margin-top:3px;font-size:10px;line-height:1.4}
*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
@media(max-width:740px){#homePage .lower{grid-template-columns:minmax(0,1fr)}.community-column{max-width:340px}}
`;document.head.append(layout);
})();

(() => {
  const section = document.querySelector('#homeStreams');
  const directory = document.querySelector('#ourStreamers');
  if (!section || !directory) return;
  const list = section.querySelector('.streams');
  const notice = section.querySelector('.empty-feed');
  list.replaceChildren();
  notice.setAttribute('role', 'status');
  notice.textContent = 'Проверяем эфиры…';
  let lastCheck = 0;
  let checking = false;

  async function findLiveCard(card) {
    const login = new URL(card.href).pathname.slice(1);
    if (!/^\w+$/.test(login)) throw Error('Некорректный канал');
    const response = await fetch('https://decapi.me/twitch/uptime/' + login, {
      signal: AbortSignal.timeout(9000), cache: 'no-store', credentials: 'omit'
    });
    if (!response.ok) throw Error('Статус недоступен');
    const uptime = (await response.text()).trim();
    if (uptime.toLowerCase() === login.toLowerCase() + ' is offline') return null;
    if (!/^\d+ (?:day|hour|minute|second)s?(?:,? \d+ (?:day|hour|minute|second)s?)*$/i.test(uptime)) throw Error('Неизвестный статус');
    const liveCard = card.cloneNode(true);
    liveCard.querySelector('p').textContent = '🔴 В эфире · Смотреть на Twitch';
    return liveCard;
  }

  async function refresh() {
    if (document.hidden || checking || Date.now() - lastCheck < 60000) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const results = await Promise.allSettled(Array.from(directory.querySelectorAll('.creator-card'), findLiveCard));
      const liveCards = results.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
      const incomplete = results.some(item => item.status === 'rejected');
      list.replaceChildren(...liveCards);
      list.hidden = liveCards.length === 0;
      list.style.display = list.hidden ? 'none' : 'grid';
      list.style.gridTemplateColumns = 'minmax(0,1fr)';
      notice.textContent = incomplete ? 'Не удалось проверить все каналы. Попробуем ещё раз через минуту.' : 'Сейчас активных стримов нет';
      notice.hidden = !incomplete && liveCards.length > 0;
    } finally {
      checking = false;
    }
  }
  refresh();
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', refresh);
})();

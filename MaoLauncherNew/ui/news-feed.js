(()=>{
 if(!window.mao?.getNews)return;
 const css=document.createElement('style');css.textContent=`
 .mao-news-feed{display:grid;gap:12px;margin-top:16px}.mao-news-card{border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden;min-width:0}.mao-news-card img{display:block;width:100%;max-height:260px;object-fit:cover}.mao-news-copy{padding:16px}.mao-news-meta{font-size:11px;color:var(--muted);margin-bottom:7px}.mao-news-card h2,.mao-news-card h3{margin:0 0 8px;font-size:17px;overflow-wrap:anywhere}.mao-news-card p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.65;color:var(--muted);margin:0}.mao-news-card a{display:inline-block;font-size:12px;color:var(--accent);margin-top:12px;text-decoration:none}.mao-news-card a:hover{text-decoration:underline}.mao-news-home .mao-news-card img{max-height:140px}.mao-news-home .mao-news-card h3{font-size:14px}.mao-news-home .mao-news-card p{font-size:12px}.mao-news-status{font-size:11px;color:var(--muted);margin:10px 0}.mao-news-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}.mao-news-refresh{background:transparent;border:1px solid var(--line);border-radius:7px;color:var(--muted);padding:7px 12px;cursor:pointer}.mao-news-refresh:hover{color:var(--text);border-color:var(--accent)}
 `;document.head.append(css);
 const template=document.querySelector('[data-template="home-news"]'),home=template?.parentElement,news=document.getElementById('newsPage');
 const targets=[];
 for(const [host,compact] of [[home,true],[news,false]]){
  if(!host)continue;
  const list=document.createElement('div');list.className='mao-news-feed'+(compact?' mao-news-home':'');list.setAttribute('aria-live','polite');host.append(list);
  const status=document.createElement('p');status.className='mao-news-status';status.textContent='Загрузка новостей…';host.append(status);
  targets.push({host,list,status,compact});
 }
 const refresh=document.createElement('button');refresh.type='button';refresh.className='mao-news-refresh';refresh.textContent='Обновить новости';if(news)news.insertBefore(refresh,news.querySelector('.mao-news-feed'));
 function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
 function card(item,compact){
  const article=el('article',undefined,'mao-news-card');
  if(item.image){const image=new Image();image.src=item.image;image.alt='Изображение к новости';image.loading='lazy';image.onerror=()=>image.remove();article.append(image)}
  const copy=el('div',undefined,'mao-news-copy');
  const date=item.publishedAt?new Date(item.publishedAt*1000).toLocaleDateString('ru-RU'):'';
  copy.append(el('div',[date,item.category].filter(Boolean).join(' · '),'mao-news-meta'),el(compact?'h3':'h2',item.title));
  const text=compact&&item.text.length>210?item.text.slice(0,210)+'…':item.text;copy.append(el('p',text));
  if(item.sourceUrl){const link=el('a','Открыть в Telegram ↗');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';copy.append(link)}
  article.append(copy);return article;
 }
 let loading=false;
 async function load(){if(loading)return;loading=true;refresh.disabled=true;try{
  const data=await window.mao.getNews();
  for(const target of targets){const items=data.items.slice(0,target.compact?2:30);target.list.replaceChildren(...items.map(x=>card(x,target.compact)));
   for(const empty of target.host.querySelectorAll(':scope > .empty-feed'))empty.hidden=items.length>0||data.unavailable;
   target.status.textContent=data.unavailable?(items.length?'Показаны сохранённые новости. Связь с сервером временно недоступна.':'Новости временно недоступны. Попробуй позже.'):'';
  }
 }catch{for(const t of targets)t.status.textContent='Не удалось загрузить новости.'}finally{loading=false;refresh.disabled=false}}
 refresh.addEventListener('click',load);load();setInterval(()=>{if(!document.hidden)load()},120000);
 document.querySelector('[data-page="news"]')?.addEventListener('click',load);
})();

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

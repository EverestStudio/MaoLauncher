(()=>{
 const panel=document.getElementById('launchProgress'),actions=document.querySelector('.hero-actions');if(!panel||!actions)return;actions.append(panel);
 const style=document.createElement('style');style.textContent='.hero-actions{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:14px}.hero-actions .play{flex-shrink:0}.hero-actions .launch-progress{margin:0!important;width:auto!important;flex:1 1 200px;min-width:0;max-width:360px}.launch-progress-head{min-width:0}.launch-progress-head #launchStage{overflow-wrap:anywhere}.launch-progress-track.is-indeterminate .launch-progress-fill{width:35%!important;animation:downloadWaiting 1.2s ease-in-out infinite alternate}@keyframes downloadWaiting{to{transform:translateX(180%)}}@media(prefers-reduced-motion:reduce){.launch-progress-track.is-indeterminate .launch-progress-fill{animation:none}}';document.head.append(style);
 if(!window.mao)return;
 // The legacy language hook must not overwrite real native download events with preview state.
 if(typeof renderLaunchProgress==='function')renderLaunchProgress=()=>{};
 window.mao.onEvent(data=>{
 if(data.type==='progress'){
 panel.hidden=false;const value=Math.max(0,Math.min(100,Number(data.percent)||0)),bar=document.getElementById('launchProgressBar');document.getElementById('launchStage').textContent=data.stage;document.getElementById('launchPercent').textContent=data.indeterminate?'…':value+'%';document.getElementById('launchProgressFill').style.width=value+'%';bar.classList.toggle('is-indeterminate',!!data.indeterminate);if(data.indeterminate)bar.removeAttribute('aria-valuenow');else bar.setAttribute('aria-valuenow',String(value));const mb=n=>(n/1048576).toFixed(1)+' МБ';document.getElementById('launchProgressNote').textContent=Number.isFinite(data.downloaded)?mb(data.downloaded)+(Number.isFinite(data.total)?' / '+mb(data.total):' получено'):'Minecraft 26.2 · Fabric · mc.maopickme.ru';
 }else if(['game-start','game-exit','launch-error'].includes(data.type))document.getElementById('launchProgressBar').classList.remove('is-indeterminate');
 });
})();

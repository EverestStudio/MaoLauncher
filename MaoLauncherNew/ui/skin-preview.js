(()=>{
 let viewer,revision=0,timer;
 const panel=document.getElementById('skinPreview'),input=document.getElementById('nickname');
 if(!panel||!input)return;
 function dispose(){if(viewer){viewer.dispose();viewer=null}}
 function hint(text){dispose();panel.replaceChildren();const span=document.createElement('span');span.className='skin-placeholder';span.textContent=text;panel.append(span)}
 function reset(){clearTimeout(timer);revision++;hint('Введи ник для просмотра скина')}
 input.addEventListener('input',()=>{clearTimeout(timer);const current=++revision,name=input.value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(name)){hint('Введи ник для просмотра скина');return}hint('Поиск скина…');timer=setTimeout(async()=>{try{const skin=await window.mao.skinModel(name);if(current!==revision)return;if(!skin){hint('Лицензионный скин не найден');return}dispose();const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','3D-модель скина '+name);canvas.setAttribute('role','img');panel.replaceChildren(canvas);const next=new skinview3d.SkinViewer({canvas,width:180,height:260});viewer=next;await next.loadSkin(skin.url,{model:skin.model});if(current!==revision||viewer!==next)return;next.autoRotate=true;next.autoRotateSpeed=.35;next.controls.enableZoom=false;next.controls.enablePan=false;next.animation=new skinview3d.IdleAnimation()}catch(error){console.warn('Skin preview:',error.message);if(current===revision)hint('Не удалось показать 3D-скин')}},500)});
 document.getElementById('offlineForm').addEventListener('reset',reset);window.addEventListener('beforeunload',dispose);window.addEventListener('mao-skin-ready',reset);
 function pause(){if(viewer)viewer.renderPaused=document.getElementById('profilePage').hidden||document.hidden}document.addEventListener('visibilitychange',pause);new MutationObserver(pause).observe(document.getElementById('profilePage'),{attributes:true,attributeFilter:['hidden']});
})();

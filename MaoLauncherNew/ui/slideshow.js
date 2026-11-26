(()=>{
 const hero=document.querySelector('.hero');if(!hero)return;
 const holder=document.createElement('div');holder.className='hero-slideshow';holder.setAttribute('aria-hidden','true');
 const slides=Array.from({length:4},(_,i)=>{const img=new Image();img.src=`../assets/backgrounds/scene-${i+1}.png`;img.alt='';img.className='hero-slide'+(i===0?' is-active':'');img.decoding='async';holder.append(img);return img});hero.prepend(holder);
 let index=0;setInterval(()=>{if(document.hidden||!hero.getBoundingClientRect().height)return;const next=(index+1)%slides.length;if(!slides[next].complete||!slides[next].naturalWidth)return;slides[index].classList.remove('is-active');slides[next].classList.add('is-active');index=next;hero.dataset.slide=String(index)},20000);
})();

const fs=require('node:fs/promises'),path=require('node:path');
const FEED_URL='https://maopickme-news.steelrework.com/api/news';
function safeUrl(raw,origin){try{const u=new URL(String(raw||''),origin);return u.protocol==='https:'?u.href:''}catch{return ''}}
function cleanFeed(data,endpoint=FEED_URL){
 if(!data||!Array.isArray(data.items))throw Error('Неверный формат новостей');
 return data.items.slice(0,50).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').map(x=>({id:x.id.slice(0,100),title:x.title.slice(0,180),text:String(x.text||'').slice(0,16000),category:String(x.category||'Новости').slice(0,80),publishedAt:Number(x.publishedAt)||0,image:x.image?safeUrl(x.image,endpoint):'',sourceUrl:/^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(x.sourceUrl||'')?x.sourceUrl:''}));
}
function createNewsFeed(root,options={}){
 const endpoint=options.url||FEED_URL,request=options.fetch||fetch,cacheFile=path.join(root,'news-cache.json');let last=null,lastAt=0,pending=null;
 async function readCache(){try{return cleanFeed(JSON.parse(await fs.readFile(cacheFile,'utf8')),endpoint)}catch{return []}}
 return async function getNews(){
  if(last&&Date.now()-lastAt<60000)return last;
  if(pending)return pending;
  pending=(async()=>{try{
   const r=await request(endpoint,{signal:AbortSignal.timeout(12000),headers:{'Accept':'application/json','User-Agent':'MaoLauncher-News/1.4.15'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   if(Number(r.headers.get('content-length'))>2097152)throw Error('Большой ответ');
   let size=0,chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>2097152)throw Error('Большой ответ');chunks.push(Buffer.from(chunk))}
   const items=cleanFeed(JSON.parse(Buffer.concat(chunks).toString('utf8')),endpoint);
   await fs.mkdir(root,{recursive:true});const temp=cacheFile+'.tmp';await fs.writeFile(temp,JSON.stringify({items}));await fs.rename(temp,cacheFile);
   last={items,cached:false,unavailable:false,updatedAt:Date.now()};lastAt=Date.now();return last;
  }catch{last={items:await readCache(),cached:true,unavailable:true};lastAt=Date.now();return last}finally{pending=null}})();return pending;
 }
}
module.exports={createNewsFeed,cleanFeed,FEED_URL};

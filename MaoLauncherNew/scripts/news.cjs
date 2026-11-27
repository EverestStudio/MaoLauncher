// Apply last: preserve every existing integration and set the final application version.
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
function edit(file,fn){const name=path.join(root,file);fs.writeFileSync(name,fn(fs.readFileSync(name,'utf8')))}
edit('main.cjs',s=>{if(!s.includes("require('./news-feed.cjs')"))s="const {createNewsFeed}=require('./news-feed.cjs');\n"+s;if(!s.includes("register('get-news'"))s=s.replace(" register('info',"," const getNews=createNewsFeed(dataRoot);register('get-news',()=>getNews());\n register('info',");return s});
edit('preload.cjs',s=>s.includes("getNews:invoke('get-news')")?s:s.replace("exposeInMainWorld('mao',{","exposeInMainWorld('mao',{getNews:invoke('get-news'),"));
edit('ui/index.html',s=>s.includes('src="news-feed.js"')?s:s.replace('</body>','<script src="news-feed.js"></script></body>'));
for(const name of ['package.json','package-lock.json'])edit(name,s=>{const p=JSON.parse(s);if(!/^\d+\.\d+\.\d+$/.test(p.version))throw Error('Invalid launcher version');if(p.packages?.[''])p.packages[''].version=p.version;if(p.build?.files&&!p.build.files.includes('news-feed.cjs'))p.build.files.push('news-feed.cjs');return JSON.stringify(p,null,2)+'\n'});
console.log('Telegram news integration applied: 1.4.15');

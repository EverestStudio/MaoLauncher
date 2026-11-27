// Apply after existing desktop and add-on integration scripts.
const fs=require('node:fs'),path=require('node:path');const root=path.join(__dirname,'..');
const file=path.join(root,'ui/native.js');let js=fs.readFileSync(file,'utf8');
js=js.replace("stage('Minecraft запущен',100);",'launchPanel.hidden=true;').replace("stage('Игра завершена',100)",'launchPanel.hidden=true');fs.writeFileSync(file,js);
const index=path.join(root,'ui/index.html');let html=fs.readFileSync(index,'utf8');if(!html.includes('src="community.js"'))html=html.replace('</body>','<script src="community.js"></script></body>');fs.writeFileSync(index,html);
for(const name of ['package.json','package-lock.json']){const f=path.join(root,name),p=JSON.parse(fs.readFileSync(f,'utf8'));if(p.packages?.[''])p.packages[''].version=p.version;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')}
console.log('Community layout integration applied: 1.4.13');

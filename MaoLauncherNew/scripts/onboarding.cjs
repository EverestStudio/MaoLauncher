// Apply after existing integrations without modifying game/profile engines.
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const file=path.join(root,'ui/index.html');let html=fs.readFileSync(file,'utf8');
html=html.replace('src="tour.js"','src="onboarding.js"');
if(!html.includes('src="community-refinement.js"'))html=html.replace('</body>','<script src="community-refinement.js"></script></body>');
fs.writeFileSync(file,html);
for(const name of ['package.json','package-lock.json']){const f=path.join(root,name),p=JSON.parse(fs.readFileSync(f,'utf8'));p.version='1.4.14';if(p.packages?.[''])p.packages[''].version=p.version;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')}
console.log('Onboarding and compact community layout applied: 1.4.14');

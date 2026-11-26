const fs=require('node:fs/promises'),path=require('node:path');
const manifest=require('./mods-manifest.json');
async function installMods(root,emit,downloadFiles){
 const folder=path.join(root,'mods');await fs.mkdir(folder,{recursive:true});
 const statePath=path.join(root,'.mao-managed-mods.json');let previous=[];
 try{previous=JSON.parse(await fs.readFile(statePath,'utf8')).files||[]}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e}
 const safe=name=>typeof name==='string'&&name===path.basename(name)&&name.endsWith('.jar');
 const files=manifest.mods.map(m=>{if(!safe(m.file)||!m.url.startsWith('https://cdn.modrinth.com/'))throw Error('Некорректный каталог модов');return {path:path.join(folder,m.file),urls:[m.url],size:m.size,checksum:{algorithm:'sha512',value:m.sha512}}});
 emit({stage:`Проверка ${files.length} модов для Fabric ${manifest.minecraft}`,percent:0});
 await downloadFiles(files,'Загрузка модов',emit);
 const current=manifest.mods.map(m=>m.file);
 // Only retire files explicitly installed by this launcher; user's other mods stay untouched.
 for(const name of previous)if(safe(name)&&!current.includes(name))await fs.rm(path.join(folder,name),{force:true});
 await fs.writeFile(statePath+'.tmp',JSON.stringify({minecraft:manifest.minecraft,files:current},null,2));await fs.rename(statePath+'.tmp',statePath);
 emit({stage:'Моды установлены',percent:100});return current;
}
module.exports={installMods};

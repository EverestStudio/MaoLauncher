const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
async function digest(file,algorithm){const h=crypto.createHash(algorithm);for await(const b of require('node:fs').createReadStream(file))h.update(b);return h.digest('hex')}
module.exports=async function downloadFiles(files,stage,emit){
 const entries=files.map(f=>({...f,size:Number(f.size)>0?Number(f.size):null,bytes:0,done:false}));let last=0;
 function report(final=false){if(!final&&Date.now()-last<100)return;last=Date.now();const downloaded=entries.reduce((n,f)=>n+f.bytes,0),known=entries.every(f=>f.size!==null),total=known?entries.reduce((n,f)=>n+f.size,0):null;const fraction=known&&total?downloaded/total:entries.length?entries.reduce((n,f)=>n+(f.done?1:f.size?Math.min(.99,f.bytes/f.size):0),0)/entries.length:1;emit({stage,percent:final?100:Math.min(99,Math.floor(fraction*100)),downloaded,total,indeterminate:!final&&!known})}
 let cursor=0;
 async function worker(){while(cursor<entries.length){const f=entries[cursor++];let valid=false;try{const st=await fs.stat(f.path);valid=(!f.size||st.size===f.size)&&(!f.checksum||await digest(f.path,f.checksum.algorithm)===f.checksum.value);if(valid){f.size=st.size;f.bytes=st.size}}catch{}
 if(!valid){await fs.mkdir(path.dirname(f.path),{recursive:true});let error;const tmp=f.path+'.part';for(let attempt=0;attempt<3;attempt++){f.bytes=0;try{const response=await fetch(f.urls[attempt%f.urls.length],{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('HTTP '+response.status);const length=Number(response.headers.get('content-length'));if(f.size===null&&length>0&&!response.headers.get('content-encoding'))f.size=length;const out=await fs.open(tmp,'w');try{for await(const chunk of response.body){await out.write(chunk);f.bytes+=chunk.length;report()}}finally{await out.close()}if(f.size!==null&&f.bytes!==f.size)throw Error('Неполный файл '+path.basename(f.path));if(f.checksum&&await digest(tmp,f.checksum.algorithm)!==f.checksum.value)throw Error('Ошибка контрольной суммы');await fs.rename(tmp,f.path);f.size=f.bytes;error=null;break}catch(e){error=e;f.bytes=0;await fs.rm(tmp,{force:true}).catch(()=>{})}}if(error)throw error}
 f.done=true;report()
 }}
 report();await Promise.all(Array.from({length:4},worker));report(true)
};

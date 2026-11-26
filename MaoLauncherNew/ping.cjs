const net=require('node:net'),dns=require('node:dns/promises'),{performance}=require('node:perf_hooks'),crypto=require('node:crypto');
function vi(n){const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b)}while(n);return Buffer.from(out)}
function readVi(b,offset=0){let n=0;for(let i=0;i<5;i++){if(offset+i>=b.length)return null;const c=b[offset+i];n|=(c&127)<<(7*i);if(!(c&128))return {value:n>>>0,bytes:i+1}}throw Error('Invalid VarInt')}
function packet(payload){return Buffer.concat([vi(payload.length),payload])}
async function pingServer(){
 const address='mc.maopickme.ru';let host=address,port=25565;
 try{const records=await dns.resolveSrv('_minecraft._tcp.'+address);if(records.length){records.sort((a,b)=>a.priority-b.priority);host=records[0].name;port=records[0].port}}catch{}
 return new Promise((resolve,reject)=>{
  const socket=net.connect({host,port});let buffer=Buffer.alloc(0),phase='status',done=false,status=null,started=0;
  const token=crypto.randomBytes(8),timer=setTimeout(()=>finish(Error('Сервер не ответил за 8 секунд')),8000);
  function finish(error,value){if(done)return;done=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve(value)}
  socket.on('error',e=>finish(e));socket.on('close',()=>{if(!done)finish(Error('Сервер закрыл соединение'))});
  socket.on('connect',()=>{
   const text=Buffer.from(address),p=Buffer.alloc(2);p.writeUInt16BE(port);
   socket.write(Buffer.concat([packet(Buffer.concat([vi(0),vi(-1),vi(text.length),text,p,vi(1)])),packet(vi(0))]));
  });
  socket.on('data',chunk=>{
   try{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length){
     const length=readVi(buffer);if(!length)return;if(length.value>2097152)throw Error('Слишком большой ответ');
     if(buffer.length<length.bytes+length.value)return;
     const body=buffer.subarray(length.bytes,length.bytes+length.value);buffer=buffer.subarray(length.bytes+length.value);
     const id=readVi(body);if(!id)throw Error('Пустой ответ');
     if(phase==='status'&&id.value===0){
      const size=readVi(body,id.bytes);if(!size||size.value>1048576||body.length<id.bytes+size.bytes+size.value)throw Error('Некорректный ответ статуса');
      status=JSON.parse(body.subarray(id.bytes+size.bytes,id.bytes+size.bytes+size.value).toString('utf8'));
      phase='pong';started=performance.now();socket.write(packet(Buffer.concat([vi(1),token])));
     }else if(phase==='pong'&&id.value===1){
      if(!body.subarray(id.bytes).equals(token))throw Error('Неверный pong');
      finish(null,{online:true,ms:Math.max(1,Math.round(performance.now()-started)),players:Number.isInteger(status?.players?.online)?status.players.online:null,max:Number.isInteger(status?.players?.max)?status.players.max:null,version:typeof status?.version?.name==='string'?status.version.name:'',motd:typeof status?.description?.text==='string'?status.description.text:''});
      return;
     }
    }
   }catch(e){finish(e)}
  });
 });
}
module.exports={pingServer,readVi,vi};

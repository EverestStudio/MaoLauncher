const {prepareJava,prepareGame,splitArgs,offlineId,MINECRAFT_VERSION}=require('./game.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{
 assert.equal(MINECRAFT_VERSION,'26.2');
 assert.deepEqual(splitArgs('-Dfoo="a b" -XX:+UseG1GC'),['-Dfoo=a b','-XX:+UseG1GC']);
 assert.equal(offlineId('Notch'),'b50ad385829d3141a2167e7d7539ba7f');
 const root=process.env.MAO_TEST_GAME_ROOT||path.join(os.tmpdir(),'mao-game-26.2-validation');
 let stage='',last=0;
 function progress(p){if(p.stage!==stage||p.percent===100&&Date.now()-last>1000){console.log(p.stage,p.percent);stage=p.stage;last=Date.now()}}
 const java=await prepareJava(root,progress);
 const javaCheck=spawnSync(java,['-version'],{encoding:'utf8',timeout:15000});
 const javaText=(javaCheck.stdout||'')+(javaCheck.stderr||'');
 assert.equal(javaCheck.status,0,'Bundled Java runtime failed to start: '+javaText);
 assert.match(javaText,/version "25(?:[."])/,'Minecraft 26.2 requires Java 25: '+javaText);
 const gameRoot=path.join(root,'minecraft');
 const version=await prepareGame(gameRoot,progress);
 assert.match(version,/^fabric-loader-.+-26\.2$/,'Unexpected Fabric profile: '+version);
 const {generateArguments}=require('@xmcl/core');
 const args=await generateArguments({gamePath:gameRoot,javaPath:java,version,gameProfile:{name:'MaoBuildTest',id:offlineId('MaoBuildTest')},accessToken:'0',userType:'legacy',maxMemory:4096,quickPlayMultiplayer:'mc.maopickme.ru'});
 assert(args.some(a=>/Xmx4096M/i.test(a)),'Configured memory argument is missing');
 assert(args.some(a=>String(a).includes('net.minecraft.client.main.Main')||String(a).includes('KnotClient')),'Minecraft/Fabric main class is missing');
 console.log('VALIDATED: Minecraft '+MINECRAFT_VERSION+', Fabric profile '+version+', Java 25, '+args.length+' launch arguments');
})().catch(e=>{console.error(e);process.exit(1)});

import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
execFileSync('npm',['run','build','-w','server'],{stdio:'pipe'});
const {createGameServer}=await import('../../server/dist/server/src/app.js');
const {RoomManager}=await import('../../server/dist/server/src/rooms.js');
const {createOnlineGame}=await import('../../server/dist/shared/src/index.js');
let time=Date.now(),serial=0;
const manager=new RoomManager(()=>time,()=>0),server=createGameServer({manager,logger:{error:()=>{}}});
server.http.listen(3196,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:5196',vite=spawn('npm',['run','dev','-w','client','--','--host','127.0.0.1','--port','5196','--strictPort'],{env:{...process.env,DEV_SERVER_URL:'http://127.0.0.1:3196'},stdio:'pipe',detached:true});
const sockets=[],errors=[];let browser;
const send=(s,command)=>new Promise((resolve,reject)=>s.timeout(1500).emit('command',{id:`retirement-browser-${++serial}`,command},(e,r)=>e?reject(e):resolve(r)));
async function wait(fn){for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,75));}throw new Error('UI did not settle');}
try{
 await wait(async()=>{try{return(await fetch(url)).ok;}catch{return false;}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??process.argv[2],headless:true,args:['--no-sandbox','--disable-background-timer-throttling']});
 for(let i=0;i<3;i++){const s=io('http://127.0.0.1:3196',{forceNew:true,transports:['websocket']});sockets.push(s);await once(s,'connect');}
 const created=await send(sockets[0],{type:'create',name:'Host',token:'circle',capacity:3,reducedMotion:true}),sessions=[created.session];
 for(let i=1;i<3;i++)sessions.push((await send(sockets[i],{type:'join',name:`Guest ${i}`,token:['circle','triangle','square'][i],code:created.room.code,reducedMotion:true})).session);
 const room=manager.rooms.get(created.room.code);room.game=createOnlineGame(room.members,1234);Object.assign(room.game,{phase:'actions',turn:1,turnOrder:room.members.map(p=>p.id),turnSelection:null});room.game.ownership[1]=sessions[1].playerId;
 const pages=[];
 for(let i=0;i<3;i++){
  const p=await browser.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(session=>{if(!sessionStorage.getItem('retirement-initialized')){sessionStorage.setItem('property-tycoon-room',JSON.stringify(session));sessionStorage.setItem('retirement-initialized','yes');}},sessions[i]);
  await p.goto(url);await p.locator('.playing').waitFor();pages.push(p);
 }
 await pages[0].getByRole('button',{name:'Players & Host',exact:true}).click();await pages[0].getByRole('dialog').waitFor();assert.match(await pages[0].getByRole('dialog').innerText(),/Host · Host/);assert.match(await pages[0].getByRole('dialog').innerText(),/Playing/);
 await pages[1].reload();await pages[1].locator('.playing').waitFor();assert.equal(room.members.length,3);
 console.log('PASS online roster identifies host and secure refresh preserves one seat');
 await pages[1].context().setOffline(true);server.io.sockets.sockets.get(room.members[1].socketId).conn.close();
 const remove=pages[0].getByRole('dialog').getByRole('listitem').filter({hasText:'Guest 1'}).getByRole('button',{name:'Retire player',exact:true});await remove.waitFor();assert.equal(await remove.isEnabled(),true);assert.match(await pages[0].getByRole('dialog').innerText(),/Away/);
 pages[0].once('dialog',d=>d.dismiss());await remove.click();assert.equal(room.game.players[1].bankrupt,false);
 pages[0].once('dialog',d=>d.accept());await remove.click();await wait(async()=>room.game.players[1].retired);
 await wait(async()=>room.game.phase==='auction');assert.equal(room.game.auction.propertyId,1);assert.ok(!room.game.auction.participants.includes(sessions[1].playerId));
 await pages[1].context().setOffline(false);
 console.log('PASS host retirement requires confirmation and auctions preserved assets');
 // Retire the host during the auction. Only one active player remains.
 pages[0].once('dialog',d=>d.dismiss());await pages[0].getByRole('dialog').getByRole('button',{name:'Retire From Game',exact:true}).click();assert.equal(room.hostId,sessions[0].playerId);
 pages[0].once('dialog',d=>d.accept());await pages[0].getByRole('dialog').getByRole('button',{name:'Retire From Game',exact:true}).click();await pages[0].locator('#player-name').waitFor();
 assert.equal(await pages[0].evaluate(()=>sessionStorage.getItem('property-tycoon-room')),null);assert.equal(room.hostId,sessions[2].playerId);assert.equal(room.game.winnerId,sessions[2].playerId);assert.equal(room.game.phase,'finished');assert.deepEqual(errors,[]);
 console.log('PASS voluntary quit requires confirmation, transfers host, clears credentials and declares the last player winner');
}finally{for(const s of sockets)s.disconnect();await browser?.close();await server.close();try{process.kill(-vite.pid,'SIGTERM');}catch{}}

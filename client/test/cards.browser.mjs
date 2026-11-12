import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
execFileSync('npm',['run','build','-w','server'],{stdio:'pipe'});
const {createGameServer}=await import('../../server/dist/server/src/app.js');
const {createOnlineGame}=await import('../../server/dist/shared/src/index.js');
const url='http://127.0.0.1:5194',backend='http://127.0.0.1:3194';
const server=createGameServer({logger:{error:()=>{}}});server.http.listen(3194,'127.0.0.1');await once(server.http,'listening');
const vite=spawn('npm',['run','dev','-w','client','--','--host','127.0.0.1','--port','5194','--strictPort'],{env:{...process.env,DEV_SERVER_URL:backend},stdio:'pipe',detached:true});let output='';vite.stdout.on('data',d=>output+=d);vite.stderr.on('data',d=>output+=d);
let browser;const sockets=[],errors=[];let serial=0;
async function wait(fn){for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,75));}throw new Error('Presentation did not settle');}
const send=(s,command)=>new Promise((resolve,reject)=>s.timeout(1500).emit('command',{id:`cards-browser-${++serial}`,command},(err,r)=>err?reject(err):resolve(r)));
try{
 await wait(async()=>{try{return(await fetch(url)).ok;}catch{return false;}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??process.argv[2],headless:true,args:['--no-sandbox','--disable-background-timer-throttling']});
 const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(window.__roll?.length){array[0]=window.__roll.shift();return array;}return original(array);};});
 await page.goto(url);
 const colors=await page.locator('.property-color').evaluateAll(strips=>[...new Set(strips.map(s=>getComputedStyle(s.parentElement).getPropertyValue('--property-color')))].sort());
 assert.deepEqual(colors,['#995C40','#49B8E8','#E46AA5','#F29A38','#E85B56','#E5C547','#43A77A','#5278D5'].sort());
 for(const [selector,color]of [['.tax','rgb(255, 240, 184)'],['.treasure','rgb(217, 243, 250)'],['.luck','rgb(255, 229, 214)'],['.transit','rgb(226, 240, 250)'],['.utility','rgb(220, 243, 234)']])assert.equal(await page.locator(`.board ${selector}`).first().evaluate(e=>getComputedStyle(e).backgroundColor),color);
 console.log('PASS consistent eight-group palette and distinct full-tile special-space backgrounds');
 const roll=async()=>{await page.evaluate(()=>{window.__roll=[0,1,1234];});await page.getByRole('button',{name:'Roll Dice',exact:true}).click();};
 const finish=async()=>{await wait(async()=>{const proceed=page.getByRole('button',{name:'Continue',exact:true});if(await proceed.count()){await proceed.click();return false;}return await page.locator('.playing').getAttribute('data-busy')==='false';});};
 for(const [card,extra]of [['luck-02',''],['treasure-01',''],['treasure-07',''],['treasure-03',''],['luck-05','&owned=1'],['luck-07','&owned=1'],['luck-10',''],['luck-11',''],['luck-12','&repairs=1'],['luck-09',''],['luck-15',''],['treasure-09',''],['treasure-03','&debt=1']]){
  await page.goto(`${url}/test/fixtures.html?card=${card}${extra}`);await page.locator('.playing').waitFor();await roll();await page.locator('.drawn-card').waitFor();
  const cardSpace=card.startsWith('luck')?7:17;
  assert.equal(await page.locator(`[data-space-id="${cardSpace}"] [data-player-id="player-1"]`).count(),1);
  assert.equal(await page.locator('.current-cash').innerText(),extra.includes('debt')?'$0':'$1,500');
  assert.equal(await page.getByRole('button',{name:'Roll Dice',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Continue',exact:true}).evaluate(button=>{button.click();button.click();});await finish();
  const state=JSON.parse(await page.locator('[data-fixture-state]').textContent());assert.equal(state.revision,1);assert.equal(await page.locator(`.occupants [data-player-id="player-1"]`).evaluate(el=>Number(el.closest('.space').dataset.spaceId)),state.players[0].position);
  assert.equal(await page.locator('.current-cash').innerText(),`$${state.players[0].cash.toLocaleString('en-US')}`);
  assert.equal(await page.locator('.active-token').evaluate(e=>getComputedStyle(e).animationName),'none');
  if(extra.includes('debt')){assert.equal(state.phase,'debt');await page.getByRole('button',{name:'Declare bankruptcy',exact:true}).click();await wait(async()=>JSON.parse(await page.locator('[data-fixture-state]').textContent()).players[0].bankrupt);assert.equal(await page.locator('.drawn-card').count(),0);}
  console.log(`PASS offline ${card}: arrival, explicit Continue, authoritative checkpoints, no duplicate effect`);
 }
 await page.goto(`${url}/test/fixtures.html?card=luck-10&chain=1`);await page.locator('.playing').waitFor();await roll();await page.locator('.drawn-card').waitFor();
 const firstCard=await page.locator('[data-card-event]').getAttribute('data-card-event');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await wait(async()=>{const next=page.locator('[data-card-event]');return await next.count()&&await next.getAttribute('data-card-event')!==firstCard;});
 assert.match(await page.getByRole('dialog').innerText(),/Garden sponsorship/);assert.equal(await page.locator('.current-cash').innerText(),'$1,500');await finish();assert.equal(await page.locator('.current-cash').innerText(),'$1,600');
 console.log('PASS chained Luck-to-Treasure movement waits for both cards before their effects');
 // Exercise real 300 ms forward and backward steps, not only reduced motion.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(`${url}/test/fixtures.html?card=luck-10`);await page.locator('.playing').waitFor();
 await page.evaluate(()=>{window.__path=[];let last;new MutationObserver(()=>{const id=document.querySelector('.occupants [data-player-id="player-1"]')?.closest('.space')?.dataset.spaceId;if(id!==last){window.__path.push(Number(id));last=id;}}).observe(document.querySelector('.board'),{subtree:true,childList:true});});
 await roll();await page.locator('.drawn-card').waitFor();assert.deepEqual((await page.evaluate(()=>window.__path)).filter(n=>n>=5),[5,6,7]);await finish();const path=await page.evaluate(()=>window.__path);assert.deepEqual(path.slice(-3),[6,5,4]);await page.screenshot({path:'/tmp/tycoon-card-sequence.png'});
 console.log('PASS normal motion reaches Luck before the card and moves backward only after Continue');
 // Set up three real browser seats, all using secure resume credentials.
 for(let i=0;i<3;i++){const s=io(backend,{forceNew:true,transports:['websocket']});sockets.push(s);await once(s,'connect');}
 const created=await send(sockets[0],{type:'create',name:'A',token:'circle',capacity:3,reducedMotion:true}),sessions=[created.session];
 for(let i=1;i<3;i++)sessions.push((await send(sockets[i],{type:'join',name:`P${i}`,token:['circle','triangle','square'][i],code:created.room.code,reducedMotion:true})).session);
 const room=server.manager.rooms.get(created.room.code);room.game=createOnlineGame(room.members,1234);Object.assign(room.game,{phase:'awaiting-roll',turnOrder:room.members.map(m=>m.id),turnSelection:null,turn:1});room.game.decks.Treasure.draw=['treasure-07',...room.game.decks.Treasure.draw.filter(id=>id!=='treasure-07')];server.manager.entropy=()=>0;
 const pages=[];
 for(let i=0;i<3;i++){
  const p=await browser.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(session=>{if(!sessionStorage.getItem('property-tycoon-room'))sessionStorage.setItem('property-tycoon-room',JSON.stringify(session));},sessions[i]);await p.goto(url);await p.locator('.playing').waitFor();pages.push(p);
 }
 await pages[0].getByRole('button',{name:'Roll Dice',exact:true}).click();for(const p of pages)await p.locator('.drawn-card').waitFor();
 const eventId=await pages[0].locator('[data-card-event]').getAttribute('data-card-event');
 for(let i=0;i<3;i++){assert.equal(await pages[i].locator('[data-card-event]').getAttribute('data-card-event'),eventId);assert.equal(await pages[i].locator('.current-cash').innerText(),'$1,500');if(i)assert.match(await pages[i].getByRole('dialog').innerText(),/Waiting for A to continue/);}
 await pages[0].reload();await pages[0].locator('.drawn-card').waitFor();assert.equal(await pages[0].locator('[data-card-event]').getAttribute('data-card-event'),eventId);assert.equal(await pages[0].locator(`[data-space-id="2"] [data-player-id="${sessions[0].playerId}"]`).count(),1);
 await pages[0].context().setOffline(true);server.io.sockets.sockets.get(room.members[0].socketId).conn.close();await wait(async()=>/Waiting for A to reconnect/.test(await pages[1].locator('.online-status').innerText()));
 await pages[0].context().setOffline(false);await wait(()=>pages[0].getByRole('button',{name:'Continue',exact:true}).isEnabled());
 await pages[0].getByRole('button',{name:'Continue',exact:true}).evaluate(button=>{button.click();button.click();});
 for(const p of pages){await p.locator('.drawn-card').waitFor({state:'hidden'});await wait(async()=>await p.locator('.current-cash').innerText()==='$1,600');}
 assert.equal(room.game.revision,1);assert.equal(room.game.players[0].cash,1600);assert.equal(room.members.length,3);assert.equal(room.presentation.acknowledged.length,1);assert.deepEqual(errors,[]);
 console.log('PASS three browsers share the card, wait for its owner, refresh/reconnect and continue exactly once');
}finally{for(const s of sockets)s.disconnect();await browser?.close();await server.close();try{process.kill(-vite.pid,'SIGTERM');}catch{}}

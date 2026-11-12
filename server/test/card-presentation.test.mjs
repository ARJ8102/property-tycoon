import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {RoomManager} from '../dist/server/src/rooms.js';
import {createGameServer} from '../dist/server/src/app.js';
import {createOnlineGame,nextPresentationCard} from '../dist/shared/src/index.js';
let serial=0;
function setup(reducedMotion=true){
 let time=1000;const m=new RoomManager(()=>time,()=>0),c=[{id:'a'},{id:'b'},{id:'c'}];
 const create=m.command(c[0],`card-test-${++serial}`,{type:'create',name:'A',token:'circle',capacity:3,reducedMotion});const sessions=[create.session];
 for(let i=1;i<3;i++)sessions.push(m.command(c[i],`card-test-${++serial}`,{type:'join',name:`P${i}`,token:['circle','triangle','square'][i],code:create.room.code,reducedMotion}).session);
 const room=m.rooms.get(create.room.code);room.game=createOnlineGame(room.members,1234);room.game.phase='awaiting-roll';room.game.turnOrder=room.game.players.map(p=>p.id);room.game.turnSelection=null;room.game.turn=1;room.game.players[0].position=0;
 room.game.decks.Treasure.draw=['treasure-09',...room.game.decks.Treasure.draw.filter(id=>id!=='treasure-09')];
 const send=(i,command,id=`card-test-${++serial}`)=>m.command(c[i],id,command);
 const roll=()=>send(0,{type:'action',action:{type:'ROLL',expectedRevision:room.game.revision}});
 return {m,c,room,sessions,send,roll,advance:n=>time+=n};
}
test('three seats share the card gate; only its drawing seat continues, once, without replaying transfers',()=>{
 const f=setup(),r=f.roll(),p=r.room.presentation,card=nextPresentationCard(p);const balances=r.room.game.players.map(p=>p.cash),revision=r.room.game.revision;
 assert.deepEqual(balances,[1520,1490,1490]);
 for(const c of f.c)assert.deepEqual(f.m.snapshot(c).presentation,p);
 const command={type:'continue-card',revision,eventId:card.id};
 assert.throws(()=>f.send(1,command),/drawing player/);
 assert.throws(()=>f.send(0,{...command,eventId:card.id+1}),/no longer pending/);
 assert.throws(()=>f.send(0,{...command,revision:revision-1}),/no longer pending/);
 assert.throws(()=>f.send(0,{type:'action',action:{type:'END_TURN',expectedRevision:revision}}),/continue the card/);
 f.m.disconnect(f.c[0]);assert.match(f.m.snapshot(f.c[1]).paused,/A.*reconnect/);
 const resumed={id:'restored'};const restored=f.m.command(resumed,`card-test-${++serial}`,{type:'resume',code:f.room.code,secret:f.sessions[0].secret,reducedMotion:true});f.c[0]=resumed;
 assert.deepEqual(restored.room.presentation,p);assert.equal(restored.session.playerId,f.sessions[0].playerId);
 const continued=f.send(0,command,'continue-once');assert.deepEqual(continued.room.presentation.acknowledged,[card.id]);
 assert.throws(()=>f.send(0,command,'continue-once'),/Duplicate/);assert.throws(()=>f.send(0,command),/already continued/);
 assert.deepEqual(f.room.game.players.map(p=>p.cash),balances);assert.equal(f.room.game.revision,revision);
 assert.equal(f.send(0,{type:'action',action:{type:'ROLL',expectedRevision:revision}}).room.game.revision,revision+1);
 for(const session of f.sessions)assert.ok(!JSON.stringify(p).includes(session.secret));
 assert.ok(p.steps.every(s=>s.snapshot.decks===null&&s.snapshot.debtContinuation===null));
});
test('early Continue is rejected immediately; animations never delay command acknowledgment',()=>{
 const f=setup(false),r=f.roll(),card=nextPresentationCard(r.room.presentation),command={type:'continue-card',revision:r.room.game.revision,eventId:card.id};
 assert.ok(r.room.cardReadyInMs>0);assert.throws(()=>f.send(0,command),/reach the card space/);
 f.advance(r.room.cardReadyInMs);const result=f.send(0,command);assert.ok(result.room.animationRemainingMs>0);
 assert.throws(()=>f.send(0,{type:'action',action:{type:'ROLL',expectedRevision:f.room.game.revision}}),/movement to finish/);
 f.advance(result.room.animationRemainingMs);assert.equal(f.send(0,{type:'action',action:{type:'ROLL',expectedRevision:f.room.game.revision}}).room.game.revision,2);
});
test('chained draws require a separate validated Continue for each card',()=>{
 const f=setup();f.room.game.players[0].position=34;
 f.room.game.decks.Luck.draw=['luck-10',...f.room.game.decks.Luck.draw.filter(id=>id!=='luck-10')];f.room.game.decks.Treasure.draw=['treasure-07',...f.room.game.decks.Treasure.draw.filter(id=>id!=='treasure-07')];
 const r=f.roll(),cards=r.room.presentation.steps.filter(s=>s.event.card).map(s=>s.event);
 assert.equal(cards.length,2);const command={type:'continue-card',revision:1,eventId:cards[0].id};
 f.send(0,command);assert.equal(nextPresentationCard(f.m.snapshot(f.c[1]).presentation).id,cards[1].id);
 assert.throws(()=>f.send(0,command),/already continued/);
 f.send(0,{...command,eventId:cards[1].id});assert.equal(nextPresentationCard(f.m.snapshot(f.c[1]).presentation),undefined);
 assert.equal(f.room.game.players[0].cash,1600);assert.equal(f.room.game.revision,1);
});
test('real Socket.IO card acknowledgments and three-client broadcasts finish promptly',async()=>{
 const server=createGameServer({logger:{error:()=>{}}}),sockets=[];server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
 const send=(s,command)=>new Promise((resolve,reject)=>s.timeout(1500).emit('command',{id:`wire-card-${++serial}`,command},(err,r)=>err?reject(err):resolve(r)));
 try{
  for(let i=0;i<3;i++){const s=io(`http://127.0.0.1:${server.http.address().port}`,{forceNew:true,transports:['websocket']});sockets.push(s);await once(s,'connect');}
  const first=await send(sockets[0],{type:'create',name:'A',token:'circle',capacity:3,reducedMotion:true});
  for(let i=1;i<3;i++)await send(sockets[i],{type:'join',name:`P${i}`,token:['circle','triangle','square'][i],code:first.room.code,reducedMotion:true});
  const room=server.manager.rooms.get(first.room.code);room.game=createOnlineGame(room.members,1234);Object.assign(room.game,{phase:'awaiting-roll',turnOrder:room.members.map(m=>m.id),turnSelection:null,turn:1});room.game.decks.Treasure.draw=['treasure-07',...room.game.decks.Treasure.draw.filter(id=>id!=='treasure-07')];server.manager.entropy=()=>0;
  const updates=sockets.map(s=>once(s,'room'));const roll=await send(sockets[0],{type:'action',action:{type:'ROLL',expectedRevision:0}});
  for(const update of await Promise.all(updates))assert.deepEqual(update[0].presentation,roll.room.presentation);
  const card=nextPresentationCard(roll.room.presentation),command={type:'continue-card',revision:1,eventId:card.id};
  assert.equal((await send(sockets[1],command)).ok,false);assert.equal((await send(sockets[0],command)).ok,true);assert.equal((await send(sockets[0],command)).ok,false);
  assert.equal(room.game.players[0].cash,1600);assert.equal(room.game.revision,1);
 }finally{for(const s of sockets)s.disconnect();await server.close();}
});

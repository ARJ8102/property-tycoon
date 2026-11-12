import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../dist/server/src/rooms.js';
import {createOnlineGame,nextPresentationCard} from '../dist/shared/src/index.js';
let serial=0;
function setup(){
 let now=1000;const m=new RoomManager(()=>now,()=>0),c=[0,1,2].map(id=>({id:`socket-${id}`}));
 const send=(i,command,id=`retirement-${++serial}`)=>m.command(c[i],id,command);
 const created=send(0,{type:'create',name:'Host',token:'circle',capacity:3,reducedMotion:true});const sessions=[created.session];
 for(let i=1;i<3;i++)sessions.push(send(i,{type:'join',name:`Player ${i}`,token:['circle','triangle','square'][i],code:created.room.code,reducedMotion:true}).session);
 const room=m.rooms.get(created.room.code);room.game=createOnlineGame(room.members,1234);Object.assign(room.game,{phase:'actions',turnOrder:room.members.map(p=>p.id),turnSelection:null,turn:1});
 return {m,c,send,room,sessions,advance:ms=>now+=ms,act:(i,type,extra={})=>send(i,{type:'action',action:{type,expectedRevision:room.game.revision,...extra}})};
}
test('temporary disconnect preserves the complete game and permits progress until the required turn',()=>{
 const f=setup();f.room.game.ownership[1]=f.sessions[1].playerId;f.room.game.properties[1]={level:0,mortgaged:true};const before=structuredClone(f.room.game);
 const snapshot=f.m.disconnect(f.c[1]);assert.equal(snapshot.paused,null);assert.deepEqual(f.room.game,before);assert.equal(snapshot.players[1].offlineSince,1000);
 f.advance(45000);assert.equal(f.m.snapshot(f.c[0]).players[1].offlineForMs,45000);f.act(0,'END_TURN');assert.match(f.m.snapshot(f.c[0]).paused,/Player 1/);
 f.c[1]={id:'new-seat'};const r=f.send(1,{type:'resume',code:f.room.code,secret:f.sessions[1].secret,reducedMotion:true});
 assert.equal(r.room.paused,null);assert.equal(r.room.players[1].offlineSince,null);assert.equal(r.room.players.length,3);assert.equal(r.room.game.ownership[1],f.sessions[1].playerId);
});
test('host removal enforces two minutes, permissions, current presence and retirement atomically',()=>{
 const f=setup(),target=f.sessions[1].playerId;f.room.game.ownership[1]=target;
 assert.throws(()=>f.send(0,{type:'remove',playerId:target}),/disconnected/);f.m.disconnect(f.c[1]);
 assert.throws(()=>f.send(2,{type:'remove',playerId:target}),/host/);f.advance(119999);assert.throws(()=>f.send(0,{type:'remove',playerId:target}),/2 minutes/);
 f.advance(1);f.send(0,{type:'remove',playerId:target});assert.equal(f.room.game.players[1].retired,true);assert.equal(f.room.game.auction.propertyId,1);assert.equal(f.room.members[1].secret,'');
 assert.throws(()=>f.send(1,{type:'resume',code:f.room.code,secret:f.sessions[1].secret}),/Already|Session/);
 assert.throws(()=>f.send(0,{type:'remove',playerId:target}),/disconnected/);
});
test('reconnecting cancels removal eligibility and a new outage starts a new timer',()=>{
 const f=setup(),target=f.sessions[1].playerId;f.m.disconnect(f.c[1]);f.advance(120000);f.c[1]={id:'reconnected'};
 f.send(1,{type:'resume',code:f.room.code,secret:f.sessions[1].secret});assert.throws(()=>f.send(0,{type:'remove',playerId:target}),/disconnected/);
 f.m.disconnect(f.c[1]);assert.throws(()=>f.send(0,{type:'remove',playerId:target}),/2 minutes/);assert.equal(f.room.game.players[1].bankrupt,false);
});
test('host identity survives temporary recovery and transfers on permanent quit',()=>{
 const f=setup();f.m.disconnect(f.c[0]);assert.equal(f.m.snapshot(f.c[1]).hostId,f.sessions[0].playerId);
 f.c[0]={id:'host-resumed'};f.send(0,{type:'resume',code:f.room.code,secret:f.sessions[0].secret});
 assert.equal(f.send(0,{type:'quit'}).room,null);assert.equal(f.room.hostId,f.sessions[1].playerId);
 f.c[0]={id:'retired-resume'};assert.throws(()=>f.send(0,{type:'resume',code:f.room.code,secret:f.sessions[0].secret}),/Session/);
 const created=f.send(0,{type:'create',name:'Fresh',token:'circle',capacity:2});assert.ok(created.session);assert.notEqual(created.session.playerId,f.sessions[0].playerId);
});
test('quitting during an open card cannot trap other clients behind its gate',()=>{
 const f=setup();f.room.game.phase='awaiting-roll';f.room.game.decks.Treasure.draw=['treasure-07',...f.room.game.decks.Treasure.draw.filter(id=>id!=='treasure-07')];
 f.act(0,'ROLL');assert.ok(nextPresentationCard(f.room.presentation));f.send(0,{type:'quit'});assert.equal(f.room.presentation,null);assert.equal(f.room.busyUntil,0);assert.equal(f.m.snapshot(f.c[1]).paused,null);assert.equal(f.room.game.currentPlayerIndex,1);
});
test('server-authoritative double Launch payments survive duplicate command, Continue and secure reconnect',()=>{
 const f=setup();f.room.game.phase='awaiting-roll';f.room.game.players[0].position=38;f.room.game.decks.Luck.draw=['luck-02',...f.room.game.decks.Luck.draw.filter(id=>id!=='luck-02')];
 let i=0;f.m.entropy=()=>i++<2?[3,4][i-1]:0;
 f.send(0,{type:'action',action:{type:'ROLL',expectedRevision:0}},'roll-plaza-once');assert.equal(f.room.game.players[0].cash,1900);
 const card=nextPresentationCard(f.room.presentation),command={type:'continue-card',revision:1,eventId:card.id};f.send(0,command);
 assert.throws(()=>f.send(0,command),/already continued/);assert.throws(()=>f.send(0,{type:'action',action:{type:'ROLL',expectedRevision:0}},'roll-plaza-once'),/Duplicate/);
 f.m.disconnect(f.c[0]);f.c[0]={id:'resume-plaza'};const result=f.send(0,{type:'resume',code:f.room.code,secret:f.sessions[0].secret});assert.equal(result.room.game.players[0].cash,1900);assert.equal(result.room.game.revision,1);
});
test('retired target cannot operate a stale socket or rejoin; unrelated clients see the same retirement auctions',()=>{
 const f=setup();f.room.game.ownership[3]=f.sessions[1].playerId;f.m.disconnect(f.c[1]);f.advance(120000);f.send(0,{type:'remove',playerId:f.sessions[1].playerId});
 assert.throws(()=>f.act(1,'END_TURN'),/Join/);assert.deepEqual(f.m.snapshot(f.c[0]).game,f.m.snapshot(f.c[2]).game);
});

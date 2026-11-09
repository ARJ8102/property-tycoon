import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {createGameServer} from '../dist/server/src/app.js';
import {RoomManager} from '../dist/server/src/rooms.js';
let counter=0;
function command(socket,command){return new Promise((resolve,reject)=>socket.timeout(3000).emit('command',{id:`transport-${++counter}`,command},(err,result)=>err?reject(err):resolve(result)));}
async function connected(url){const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});await Promise.race([once(socket,'connect'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('connect timeout')),3000).unref())]);return socket;}
async function waitFor(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Broadcast timeout');}
test('real sockets synchronize room/order/dice/purchase and restore identity after transport loss',async()=>{
 const values=[5,5,0,0,0,1,0];const manager=new RoomManager(undefined,()=>values.shift()??0),server=createGameServer({manager});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const url=`http://127.0.0.1:${server.http.address().port}`;const sockets=[];
 try{
  const a=await connected(url),b=await connected(url);sockets.push(a,b);let broadcast; b.on('room',room=>broadcast=room);
  const created=await command(a,{type:'create',name:'Alice',token:'circle',capacity:2,reducedMotion:true});assert.ok(created.ok);const joined=await command(b,{type:'join',name:'Bob',token:'triangle',code:created.room.code,reducedMotion:true});assert.ok(joined.ok);
  await command(a,{type:'ready',ready:true});await command(b,{type:'ready',ready:true});let r=await command(a,{type:'start'});await waitFor(()=>broadcast?.game?.phase==='turn-order');assert.deepEqual(broadcast.game,r.room.game);
  r=await command(a,{type:'action',action:{type:'ROLL_ORDER',expectedRevision:r.room.game.revision}});r=await command(b,{type:'action',action:{type:'ROLL_ORDER',expectedRevision:r.room.game.revision}});assert.deepEqual(r.room.game.turnOrder,[created.session.playerId,joined.session.playerId]);r=await command(a,{type:'action',action:{type:'START_GAME',expectedRevision:r.room.game.revision}});
  const forged=await command(b,{type:'action',action:{type:'ROLL',expectedRevision:r.room.game.revision,actorId:created.session.playerId,dice:[6,6]}});assert.equal(forged.ok,false);
  r=await command(a,{type:'action',action:{type:'ROLL',expectedRevision:r.room.game.revision}});assert.deepEqual(r.room.game.dice,[1,2]);assert.equal(r.room.game.phase,'purchase');r=await command(a,{type:'action',action:{type:'BUY',expectedRevision:r.room.game.revision}});await waitFor(()=>broadcast?.game?.revision===r.room.game.revision);assert.deepEqual(broadcast.game,r.room.game);assert.equal(r.room.game.players[0].cash,1440);
  a.disconnect();await waitFor(()=>!!broadcast?.paused);const recovered=await connected(url);sockets.push(recovered);const resume=await command(recovered,{type:'resume',code:created.room.code,secret:created.session.secret,reducedMotion:true});assert.ok(resume.ok);assert.equal(resume.session.playerId,created.session.playerId);assert.equal(resume.room.paused,null);assert.deepEqual(resume.room.game,r.room.game);assert.ok(!JSON.stringify(broadcast).includes(created.session.secret));
  const stale=await command(recovered,{type:'action',action:{type:'END_TURN',expectedRevision:0}});assert.equal(stale.ok,false);
 }finally{for(const s of sockets)s.disconnect();await server.close();}
});

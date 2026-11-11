import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {createGameServer} from '../dist/server/src/app.js';
import {RoomManager} from '../dist/server/src/rooms.js';
let serial=0;
const send=(socket,command,id=`recovery-${++serial}`)=>new Promise((resolve,reject)=>socket.timeout(2000).emit('command',{id,command},(error,reply)=>error?reject(error):resolve(reply)));
async function wait(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('State update did not arrive');}
async function run(fn,manager){
 const logs=[],server=createGameServer({manager,logger:{error:(...args)=>logs.push(args),info:(...args)=>logs.push(args)}});
 server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const sockets=[];
 const connect=async()=>{const s=io(`http://127.0.0.1:${server.http.address().port}`,{forceNew:true,reconnection:false,transports:['websocket']});sockets.push(s);await once(s,'connect');return s;};
 try{await fn({server,logs,connect});}finally{for(const s of sockets)s.disconnect();await server.close();}
}
test('three players complete nine turns, deduplicate across reconnect and preserve active/host seats',async()=>{
 const samples=[5,5,2,2,0,0];let count=0;
 await run(async({server,logs,connect})=>{
  const players=await Promise.all([connect(),connect(),connect()]);const sessions=[];
  let result=await send(players[0],{type:'create',name:'Host',token:'circle',capacity:3,reducedMotion:true});sessions.push(result.session);const code=result.room.code;
  for(let i=1;i<3;i++){result=await send(players[i],{type:'join',code,name:`Guest ${i}`,token:['circle','triangle','square'][i],reducedMotion:true});assert.equal(result.ok,true);sessions.push(result.session);}
  const updates=[];players.forEach((p,i)=>p.on('room',r=>updates[i]=r));
  for(const p of players)assert.equal((await send(p,{type:'ready',ready:true})).ok,true);
  result=await send(players[0],{type:'start'});
  const action=async(i,type,id)=>{const reply=await send(players[i],{type:'action',action:{type,expectedRevision:result.room.game.revision}},id);assert.equal(reply.ok,true,reply.error);result=reply;};
  for(let i=0;i<3;i++)await action(i,'ROLL_ORDER');await action(0,'START_GAME');
  for(let turn=0;turn<9;turn++){
   const i=result.room.game.currentPlayerIndex;const id=`unique-roll-${turn}`;const revision=result.room.game.revision;
   await action(i,'ROLL',id);const after=result.room.game.revision;
   const duplicate=await send(players[i],{type:'action',action:{type:'ROLL',expectedRevision:revision}},id);assert.equal(duplicate.ok,false);assert.match(duplicate.error,/Duplicate/);
   assert.equal(server.manager.roomSnapshot(code).game.revision,after);
   if(result.room.game.phase==='purchase')await action(i,'BUY');await action(i,'END_TURN');
  }
  await wait(()=>updates.every(r=>r?.game?.revision===result.room.game.revision));assert.equal(result.room.game.turn,10);
  players[0].disconnect();await wait(()=>!!updates[1]?.paused);assert.equal(updates[1].hostId,sessions[0].playerId);assert.equal(updates[1].players.length,3);
  const restored=await connect();let reply=await send(restored,{type:'resume',code,secret:sessions[0].secret,reducedMotion:true});assert.equal(reply.ok,true);assert.equal(reply.session.playerId,sessions[0].playerId);assert.equal(reply.room.paused,null);assert.equal(reply.room.players.length,3);
  const duplicate=await send(restored,{type:'action',action:{type:'ROLL',expectedRevision:0}},'unique-roll-0');assert.equal(duplicate.ok,false);assert.match(duplicate.error,/Duplicate/);
  for(let i=1;i<3;i++)players[i].disconnect();restored.disconnect();await new Promise(r=>setTimeout(r,30));assert.equal(server.manager.roomSnapshot(code).players.length,3);
  reply=await send(await connect(),{type:'resume',code,secret:sessions[0].secret});assert.equal(reply.ok,true);assert.equal(reply.room.players.length,3);
  assert.ok(logs.some(([m,c])=>m.includes('acknowledgment')&&c.ok===true&&typeof c.durationMs==='number'));
  assert.ok(logs.some(([m,c])=>m.includes('disconnected')&&c.reason));for(const session of sessions)assert.ok(!JSON.stringify(logs).includes(session.secret));
 },new RoomManager(undefined,()=>samples.length?samples.shift():count++%2));
});
test('leaving a lobby permits creating a fresh room; old sessions fail clearly after restart',()=>run(async({connect})=>{
 const socket=await connect();const created=await send(socket,{type:'create',name:'Host',token:'circle',capacity:3});
 assert.equal((await send(socket,{type:'leave'})).ok,true);const next=await send(socket,{type:'create',name:'Host',token:'circle',capacity:3});assert.equal(next.ok,true);assert.notEqual(next.room.code,created.room.code);
 await run(async({connect})=>{const replacement=await connect();const missing=await send(replacement,{type:'resume',code:next.room.code,secret:next.session.secret});assert.equal(missing.ok,false);assert.match(missing.error,/expired or server restarted/);});
}));

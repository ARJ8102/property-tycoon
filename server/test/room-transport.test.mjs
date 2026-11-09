import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {createGameServer} from '../dist/server/src/app.js';
import {RoomManager} from '../dist/server/src/rooms.js';
import {ONLINE_EVENTS,SERVER_IDENTITY,isServerIdentity,isCommandReply} from '../dist/shared/src/index.js';
let serial=0;
function request(socket,command){return new Promise((resolve,reject)=>socket.timeout(1000).emit(ONLINE_EVENTS.command,{id:`integration-${++serial}`,command},(err,reply)=>err?reject(err):resolve(reply)));}
async function harness(fn,options={}){
 const logs=[],server=createGameServer({logger:{error:(...args)=>logs.push(args)},...options});const sockets=[];
 server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const url=`http://127.0.0.1:${server.http.address().port}`;
 async function connect(opts={}){const socket=io(url,{forceNew:true,reconnection:false,timeout:1000,...opts});sockets.push(socket);await once(socket,'connect');return socket;}
 try{await fn({server,url,connect,logs});}finally{for(const socket of sockets)socket.disconnect();await server.close();}
}
for(const transport of ['polling','websocket']){
 test(`real ${transport}: identity, create/join, validation acknowledgments, broadcasts and seat recovery`,()=>harness(async({connect,logs})=>{
  const a=await connect({transports:[transport]}),b=await connect({transports:[transport]}),c=await connect({transports:[transport]});
  const identity=await new Promise((resolve,reject)=>a.timeout(1000).emit(ONLINE_EVENTS.identify,(err,value)=>err?reject(err):resolve(value)));assert.deepEqual(identity,SERVER_IDENTITY);assert.ok(isServerIdentity(identity));assert.equal(isServerIdentity({...identity,service:'other-game'}),false);assert.equal(isServerIdentity({...identity,protocol:999}),false);
  const created=await request(a,{type:'create',name:'Host',token:'circle',capacity:2});assert.ok(isCommandReply(created));assert.equal(created.ok,true);assert.match(created.room.code,/^[A-Z2-9]{6}$/);assert.equal(created.room.hostId,created.session.playerId);
  const missing=await request(b,{type:'join',code:'AAAAAA',name:'Guest',token:'triangle'});assert.equal(missing.ok,false);assert.match(missing.error,/not found/);
  const malformed=await request(b,{type:'join',code:'!',name:'Guest',token:'triangle'});assert.equal(malformed.ok,false);assert.match(malformed.error,/valid six-character/);
  const duplicate=await request(b,{type:'join',code:created.room.code,name:'Guest',token:'circle'});assert.equal(duplicate.ok,false);assert.match(duplicate.error,/taken/);
  const update=once(a,ONLINE_EVENTS.room);
  const joined=await request(b,{type:'join',code:created.room.code,name:'Guest',token:'triangle'});assert.equal(joined.ok,true);assert.equal(joined.room.players.length,2);assert.equal(joined.room.hostId,created.session.playerId);assert.equal(new Set(joined.room.players.map(p=>p.token)).size,2);assert.ok(joined.room.players.every(p=>p.connected));assert.deepEqual((await update)[0],joined.room);
  const full=await request(c,{type:'join',code:created.room.code,name:'Third',token:'star'});assert.equal(full.ok,false);assert.match(full.error,/full/);
  const updates=[once(a,ONLINE_EVENTS.room),once(b,ONLINE_EVENTS.room)];const ready=await request(b,{type:'ready',ready:true});for(const result of await Promise.all(updates))assert.deepEqual(result[0],ready.room);
  b.disconnect();await new Promise(resolve=>setTimeout(resolve,30));const replacement=await connect({transports:[transport]});const resumed=await request(replacement,{type:'resume',code:created.room.code,secret:joined.session.secret});assert.equal(resumed.ok,true);assert.equal(resumed.session.playerId,joined.session.playerId);assert.equal(resumed.room.players.length,2);assert.equal(resumed.room.players.find(p=>p.id===joined.session.playerId).connected,true);assert.ok(!JSON.stringify(resumed.room).includes(joined.session.secret));
  const unknown=await request(c,{type:'unknown'});assert.equal(unknown.ok,false);assert.equal(unknown.code,'COMMAND_REJECTED');assert.ok(logs.length>=5);assert.ok(!JSON.stringify(logs).includes(joined.session.secret));
 }));
}
test('synchronous and asynchronous handler exceptions always acknowledge and log failures',()=>harness(async({server,connect,logs})=>{
 const socket=await connect();const original=server.manager.command.bind(server.manager);
 for(const asynchronous of [false,true]){
  server.manager.command=asynchronous?async()=>{throw new Error('Async room failure');}:()=>{throw new Error('Sync room failure');};
  const reply=await request(socket,{type:'create',name:'A',token:'circle',capacity:2});assert.equal(reply.ok,false);assert.match(reply.error,asynchronous?/Async/:/Sync/);assert.ok(isCommandReply(reply));
 }
 assert.equal(logs.length,2);server.manager.command=original;assert.equal((await request(socket,{type:'create',name:'A',token:'circle',capacity:2})).ok,true);
}));
test('requests lacking callbacks receive a structured error event instead of being silently ignored',()=>harness(async({connect,logs})=>{
 const socket=await connect();const failure=once(socket,ONLINE_EVENTS.error);socket.emit(ONLINE_EVENTS.command,{id:'without-callback',command:{type:'create',name:'A',token:'circle',capacity:2}});const [reply]=await failure;assert.equal(reply.ok,false);assert.equal(reply.code,'INVALID_REQUEST');assert.match(reply.error,/acknowledgment/);assert.equal(logs.length,1);
 const malformed=await new Promise((resolve,reject)=>socket.timeout(1000).emit(ONLINE_EVENTS.command,null,(err,reply)=>err?reject(err):resolve(reply)));assert.equal(malformed.ok,false);
}));
test('health identifies the application and configured cross-origin requests work',()=>harness(async({url,connect})=>{
 const response=await fetch(url+'/health');assert.deepEqual(await response.json(),{ok:true,...SERVER_IDENTITY});const socket=await connect({extraHeaders:{Origin:'http://frontend.test'},transports:['polling']});assert.equal((await request(socket,{type:'create',name:'CORS',token:'circle',capacity:2})).ok,true);
},{origins:['http://frontend.test']}));
test('a broken failure logger cannot prevent error acknowledgments',()=>harness(async({connect})=>{
 const socket=await connect();const reply=await request(socket,{type:'join',code:'!',name:'A',token:'circle'});assert.equal(reply.ok,false);assert.match(reply.error,/valid/);
},{logger:{error:()=>{throw new Error('Logger offline');}}}));

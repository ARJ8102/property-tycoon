import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {serverConfig} from '../dist/server/src/config.js';
import {createGameServer} from '../dist/server/src/app.js';

const frontend='https://property-tycoon-client.example.test';
async function until(fn,output=()=>'',attempts=100){for(let i=0;i<attempts;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw new Error(`Timed out: ${output()}`);}
async function connect(url,transport,origin){const socket=io(url,{forceNew:true,reconnection:false,timeout:1500,transports:[transport],extraHeaders:{Origin:origin}});try{await once(socket,'connect');return socket;}catch(error){socket.disconnect();throw error;}}
function command(socket,command){return new Promise((resolve,reject)=>socket.timeout(1500).emit('command',{id:`production-${Date.now()}-${Math.random().toString(36).slice(2)}`,command},(error,result)=>error?reject(error):resolve(result)));}

test('production binds all interfaces, uses PORT and normalizes FRONTEND_URL without losing legacy extra origins',()=>{
 assert.deepEqual(serverConfig({NODE_ENV:'production',PORT:'10000',HOST:'127.0.0.1',FRONTEND_URL:frontend+'/',CLIENT_ORIGINS:frontend+', https://second.example.test/'}),{port:10000,host:'0.0.0.0',origins:[frontend,'https://second.example.test']});
 assert.equal(serverConfig({}).port,3101);assert.equal(serverConfig({HOST:'127.0.0.1'}).host,'127.0.0.1');assert.deepEqual(serverConfig({CLIENT_ORIGINS:'http://localhost:5173'}).origins,['http://localhost:5173']);
});
test('missing production frontend origin and malformed ports/origins fail startup configuration clearly',()=>{
 assert.throws(()=>serverConfig({NODE_ENV:'production'}),/FRONTEND_URL is required/);
 for(const PORT of ['abc','-1','65536','1.5'])assert.throws(()=>serverConfig({PORT}),/PORT/);
 for(const FRONTEND_URL of ['*','file:///tmp/front','https://user:password@front.example','https://front.example/path','https://front.example?x=1'])assert.throws(()=>serverConfig({FRONTEND_URL}),/FRONTEND_URL/);
});
test('configured production origins allow polling and WebSocket but reject/log other origins',async()=>{
 const logs=[],config=serverConfig({NODE_ENV:'production',FRONTEND_URL:frontend}),server=createGameServer({origins:config.origins,logger:{error:(...args)=>logs.push(args)}});server.http.listen(0,'0.0.0.0');await once(server.http,'listening');const url=`http://127.0.0.1:${server.http.address().port}`;const sockets=[];
 try{
  const response=await fetch(url+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:frontend}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),frontend);
  for(const transport of ['polling','websocket']){const socket=await connect(url,transport,frontend);sockets.push(socket);const result=await command(socket,{type:'create',name:transport,token:'circle',capacity:2});assert.equal(result.ok,true);assert.match(result.room.code,/^[A-Z2-9]{6}$/);}
  for(const transport of ['polling','websocket']){const bad=io(url,{forceNew:true,reconnection:false,timeout:1000,transports:[transport],extraHeaders:{Origin:'https://unapproved.example.test'}});sockets.push(bad);await once(bad,'connect_error');assert.equal(bad.connected,false);}
  assert.ok(logs.some(([message,details])=>message.includes('connection failed')&&details.origin==='https://unapproved.example.test'));
 }finally{for(const s of sockets)s.disconnect();await server.close();}
});
test('actual production npm start runs compiled shared-engine JS, binds PORT and serves HTTP 200 health',async()=>{
 const child=spawn('npm',['start','-w','server'],{cwd:new URL('../../',import.meta.url),env:{...process.env,NODE_ENV:'production',PORT:'0',HOST:'127.0.0.1',FRONTEND_URL:frontend,CLIENT_ORIGINS:''},stdio:'pipe',detached:true});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const sockets=[];
 try{
  const match=await until(()=>{if(child.exitCode!==null)throw new Error(output);return output.match(/Server listening on 0\.0\.0\.0:(\d+)/);},()=>output);
  const base=`http://127.0.0.1:${match[1]}`;const health=await fetch(base+'/health');assert.equal(health.status,200);const body=await health.json();assert.equal(body.service,'property-tycoon');assert.equal(body.ok,true);
  const a=await connect(base,'polling',frontend),b=await connect(base,'websocket',frontend);sockets.push(a,b);const created=await command(a,{type:'create',name:'Production host',token:'circle',capacity:2});assert.equal(created.ok,true);const joined=await command(b,{type:'join',code:created.room.code,name:'Production guest',token:'triangle'});assert.equal(joined.ok,true);assert.equal(joined.room.players.length,2);assert.equal(joined.room.hostId,created.session.playerId);assert.match(output,/Frontend origins:/);
 }finally{for(const socket of sockets)socket.disconnect();try{process.kill(-child.pid,'SIGTERM');}catch{}await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});

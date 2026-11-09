import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
execFileSync('npm',['run','build','-w','server'],{stdio:'pipe'});
const {createGameServer}=await import('../../server/dist/server/src/app.js');
const {serverConfig}=await import('../../server/dist/server/src/config.js');
let browser,backend;let frontendSocketRequests=0;const errors=[];
const dist=resolve('client/dist');
const staticServer=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://static.test').pathname;
  if(pathname.startsWith('/socket.io')){frontendSocketRequests++;res.writeHead(404);res.end();return;}
  let file=resolve(dist,'.'+decodeURIComponent(pathname));
  if(file!==dist&&!file.startsWith(dist+'/')){res.writeHead(400);res.end();return;}
  let bytes;
  try{bytes=await readFile(file);}catch{file=resolve(dist,'index.html');bytes=await readFile(file);}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(500);res.end();}
});
staticServer.listen(0,'127.0.0.1');await once(staticServer,'listening');const frontend=`http://127.0.0.1:${staticServer.address().port}`;
try{
 const config=serverConfig({NODE_ENV:'production',FRONTEND_URL:frontend});backend=createGameServer({origins:config.origins});backend.http.listen(0,config.host);await once(backend.http,'listening');const api=`http://127.0.0.1:${backend.http.address().port}`;
 for(const [value,message]of [['','VITE_SERVER_URL is required'],['https://api.example.test/wrong-namespace','must be an HTTP(S) origin']]){const result=spawnSync('npm',['run','build','-w','client'],{env:{...process.env,VITE_SERVER_URL:value},encoding:'utf8'});assert.notEqual(result.status,0);assert.ok((result.stdout+result.stderr).includes(message));}
 console.log('PASS production builds reject missing or incorrectly namespaced backend URLs.');
 execFileSync('npm',['run','build','-w','client'],{env:{...process.env,VITE_SERVER_URL:api+'/'},stdio:'pipe'});
 const files=await readdir(resolve(dist,'assets'));const bundle=(await Promise.all(files.filter(f=>f.endsWith('.js')).map(f=>readFile(resolve(dist,'assets',f),'utf8')))).join('\n');assert.ok(bundle.includes(api));assert.ok(!bundle.includes('http://127.0.0.1:3101'));
 console.log('PASS VITE_SERVER_URL is baked into the production bundle; the development backend fallback is absent.');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??process.argv[2],headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const a=await browser.newPage({reducedMotion:'reduce'}),b=await browser.newPage({reducedMotion:'reduce'});for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 async function wait(fn){for(let i=0;i<100;i++){if(await fn())return;await a.waitForTimeout(100);}throw new Error('Timed out waiting for production UI');}
 const response=await a.goto(frontend);assert.equal(response.status(),200);await a.getByRole('button',{name:/^Online/}).click();await a.locator('#online-name').fill('Production host');const create=a.getByRole('button',{name:'Create table',exact:true});await wait(()=>create.isEnabled());await create.click();await a.locator('.room-heading strong').waitFor();const code=await a.locator('.room-heading strong').innerText();assert.match(code,/^[A-Z2-9]{6}$/);const invite=await a.locator('#invite-link').inputValue();assert.equal(new URL(invite).origin,frontend);assert.equal(new URL(invite).searchParams.get('room'),code);
 await b.goto(invite);await b.locator('#online-name').fill('Production guest');await b.getByRole('button',{name:'Triangle token',exact:true}).click();const join=b.getByRole('button',{name:'Join table',exact:true});await wait(()=>join.isEnabled());await join.click();await b.locator('.lobby-players').waitFor();await wait(async()=>await a.locator('.lobby-players li').count()===2);assert.equal(await b.locator('.lobby-players li').count(),2);
 const refresh=await b.reload();assert.equal(refresh.status(),200);await b.locator('.lobby-players').waitFor();assert.equal(await b.locator('.lobby-players li').count(),2);assert.equal(frontendSocketRequests,0);
 console.log('PASS the static production frontend creates/joins against the separate backend; public invites and refresh recover the lobby.');
 const offline=await browser.newPage({reducedMotion:'reduce'});await offline.goto(frontend);await offline.locator('#player-name').fill('Offline production');await offline.getByRole('button',{name:/^Create game/}).click();await offline.getByRole('dialog',{name:'Determine Turn Order',exact:true}).waitFor();assert.equal(await offline.locator('.playing').count(),1);assert.deepEqual(errors,[]);
 console.log('PASS the production frontend retains offline gameplay and has no browser runtime errors.');console.log('4 production browser checks passed.');
}finally{await browser?.close();await backend?.close();await new Promise(resolve=>staticServer.close(resolve));}

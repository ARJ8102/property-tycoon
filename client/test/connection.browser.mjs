import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn,execFileSync} from 'node:child_process';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
execFileSync('npm',['run','build','-w','server'],{stdio:'pipe'});
const {createGameServer}=await import('../../server/dist/server/src/app.js');
const url='http://127.0.0.1:5192',backend='http://127.0.0.1:3192';
const foreignHttp=createServer();const foreign=new Server(foreignHttp);foreignHttp.listen(3192,'127.0.0.1');await once(foreignHttp,'listening');
const vite=spawn('npm',['run','dev','-w','client','--','--host','127.0.0.1','--port','5192','--strictPort'],{env:{...process.env,DEV_SERVER_URL:backend},stdio:'pipe',detached:true});let output='';vite.stdout.on('data',d=>output+=d);vite.stderr.on('data',d=>output+=d);
let browser,gameServer,foreignClosed=false;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??process.argv[2],headless:true,args:['--no-sandbox']});const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(url);await page.getByRole('button',{name:/^Online/}).click();await page.getByText(/not a compatible Property Tycoon backend/).first().waitFor();assert.equal(await page.getByRole('button',{name:'Create table',exact:true}).isDisabled(),true);assert.ok(!(await page.locator('.online-status').innerText()).startsWith('Connected'));
 console.log('PASS a foreign Socket.IO backend cannot report Connected or accept room submissions');
 await new Promise(resolve=>foreign.close(resolve));foreignClosed=true;
 const logs=[];gameServer=createGameServer({logger:{error:(...args)=>logs.push(args)}});gameServer.http.listen(3192,'127.0.0.1');await once(gameServer.http,'listening');
 await page.reload();await page.getByRole('button',{name:/^Online/}).click();const submit=page.getByRole('button',{name:'Create table',exact:true});await submit.waitFor();for(let i=0;i<50&&await submit.isDisabled();i++)await page.waitForTimeout(100);assert.equal(await submit.isEnabled(),true);
 await page.locator('#online-name').fill('Host');const original=gameServer.manager.command.bind(gameServer.manager);gameServer.manager.command=async()=>{throw new Error('Room service temporarily unavailable.');};
 await submit.click();await page.getByText('Room service temporarily unavailable.',{exact:true}).first().waitFor();assert.equal(await submit.isEnabled(),true);assert.equal(logs.length,1);gameServer.manager.command=original;
 await submit.click();await page.locator('.room-heading strong').waitFor();const code=await page.locator('.room-heading strong').innerText();assert.match(code,/^[A-Z2-9]{6}$/);assert.match(await page.locator('.lobby-players').innerText(),/Host · Not ready/);
 console.log('PASS a verified backend displays async failure acknowledgments and allows successful retry');
 const guest=await browser.newPage({reducedMotion:'reduce'});await guest.goto(`${url}/?room=${code}`);await guest.locator('#online-name').fill('Guest');await guest.getByRole('button',{name:'Triangle token',exact:true}).click();const join=guest.getByRole('button',{name:'Join table',exact:true});for(let i=0;i<50&&await join.isDisabled();i++)await guest.waitForTimeout(100);await join.click();await guest.locator('.lobby-players').waitFor();assert.equal(await guest.locator('.lobby-players li').count(),2);for(let i=0;i<50&&await page.locator('.lobby-players li').count()!==2;i++)await page.waitForTimeout(100);assert.equal(await page.locator('.lobby-players li').count(),2);assert.equal(await guest.getByRole('button',{name:'Start match',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('PASS actual browser create/join requests display the shared lobby and correct host');console.log('3 connection browser checks passed.');
}finally{await browser?.close();if(!foreignClosed)await new Promise(resolve=>foreign.close(resolve));await gameServer?.close();try{process.kill(-vite.pid,'SIGTERM');}catch{}}

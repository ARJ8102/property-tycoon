import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
execFileSync('npm',['run','build','-w','server'],{stdio:'pipe'});
const url='http://127.0.0.1:5197',backend='http://127.0.0.1:3197';
const processes=[spawn(process.execPath,['server/dist/server/src/main.js'],{env:{...process.env,PORT:'3197',HOST:'127.0.0.1',CLIENT_ORIGINS:url},stdio:'pipe',detached:true}),spawn('npm',['run','dev','-w','client','--','--host','127.0.0.1','--port','5197','--strictPort'],{env:{...process.env,DEV_SERVER_URL:backend},stdio:'pipe',detached:true})];
let browser;const errors=[];
try{
 for(const endpoint of [backend+'/health',url]){let ready=false;for(let i=0;i<150;i++){try{if((await fetch(endpoint)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??process.argv[2],headless:true,args:['--no-sandbox']});
 const page=async()=>{const p=await(await browser.newContext({reducedMotion:'reduce'})).newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.getByRole('button',{name:/^Online/}).click();await p.getByRole('button',{name:'Create table',exact:true}).waitFor();return p;};
 const a=await page();await a.locator('#online-name').fill('Alice');await a.getByRole('button',{name:'Create table',exact:true}).click();const code=await a.locator('.room-heading strong').innerText();
 const join=async(p,seat,name)=>{await p.getByRole('button',{name:'Join room',exact:true}).click();await p.locator('#room-code').fill(code);if(name){await p.locator('#online-name').fill(name);await p.getByRole('button',{name:'Triangle token',exact:true}).click();}await p.getByRole('button',{name:'Find seats',exact:true}).click();await p.getByRole('button',{name:`Take Seat ${seat}`,exact:true}).click();await p.locator('.room-heading').waitFor();};
 const b=await page();await join(b,2,'Bob');b.once('dialog',d=>d.accept());await b.getByRole('button',{name:'Leave room',exact:true}).click();await b.locator('#player-name').waitFor();assert.equal(await b.evaluate(()=>sessionStorage.getItem('property-tycoon-room')),null);
 // The confirmation appears synchronously with click; accept via global handler for subsequent actions.
 const c=await page();await join(c,2);assert.match(await c.locator('.lobby-players').innerText(),/Bob/);assert.equal(await c.getByRole('button',{name:'Start match',exact:true}).count(),0);
 await a.getByRole('button',{name:'Players & Host',exact:true}).click();const dialog=a.getByRole('dialog');await dialog.getByRole('button',{name:'Lock seat 2',exact:true}).click();await dialog.getByRole('button',{name:'Unlock seat 2',exact:true}).waitFor();await dialog.getByRole('button',{name:'Unlock seat 2',exact:true}).click();
 a.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Remove occupant',exact:true}).nth(1).click();await c.getByText('Your seat was released by the host. Return using the room code.',{exact:true}).first().waitFor();assert.equal(await c.evaluate(()=>sessionStorage.getItem('property-tycoon-room')),null);
 a.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Close room',exact:true}).click();await a.getByText('The host closed this room.',{exact:true}).first().waitFor();await a.locator('#player-name').waitFor();await a.getByRole('button',{name:/^Online/}).click();await a.locator('#online-name').fill('Fresh');await a.getByRole('button',{name:'Create table',exact:true}).click();await a.locator('.room-heading').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS numbered seats, code-only cross-browser reclaim, preserved name, leave to offline, locks, host release, close, and fresh room');
}finally{await browser?.close();for(const p of processes)if(p.pid){try{process.kill(-p.pid,'SIGTERM');}catch{}}}

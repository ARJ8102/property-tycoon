import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const url='http://127.0.0.1:5188';
const server=spawn('npm',['run','dev','-w','client','--','--host','127.0.0.1','--port','5188','--strictPort'],{stdio:'pipe',detached:process.platform!=='win32'});
let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
let browser,lastPage;
const artifactDir=process.env.BROWSER_ARTIFACT_DIR ?? process.argv[3];
if(artifactDir)await mkdir(artifactDir,{recursive:true});
let checks=0;
async function check(name,fn){if(process.argv[4]&&!new RegExp(process.argv[4]).test(name))return;await fn();checks++;console.log(`PASS ${name}`);}
try {
 let ready=false;
 for(let attempt=0;attempt<100;attempt++) {
  if(server.exitCode!==null)throw new Error(output);
  try{if((await fetch(url)).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error(`Vite did not start. ${output}`);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? process.argv[2],headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({reducedMotion:'reduce'});lastPage=page;const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser runtime error:',e.message);});
 await page.addInitScript(()=>{
  const original=crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto,'getRandomValues',{value:array=>{if(window.__diceQueue?.length){array[0]=window.__diceQueue.shift();return array;}return original(array);}});
 });
 const queue=values=>page.evaluate(v=>{window.__diceQueue=v;},values);
 const create=async(count=2)=>{await page.goto(url);await page.locator('#player-name').fill('Taylor');await page.getByRole('button',{name:`${count} ${count-1} ${count===2?'bot':'bots'}`,exact:true}).click();await page.getByRole('button',{name:/^Create game/}).click();await page.locator('.playing').waitFor();await queue([5,5,4,4,3,3,2,2].slice(0,count*2));await page.getByRole('button',{name:'Roll for Turn Order',exact:true}).click();await page.getByRole('button',{name:'Start Game',exact:true}).click();};
 const fixture=async(name,space=9,development=0)=>{await page.goto(`${url}/test/fixtures.html?space=${space}&development=${development}#${name}`);await page.reload();await page.locator('.playing').waitFor();};
 const state=async()=>JSON.parse(await page.locator('[data-fixture-state]').textContent());
 const waitFor=async(fn)=>{for(let i=0;i<150;i++){if(await fn())return;await page.waitForTimeout(100);}throw new Error('Timed out waiting for UI state.');};
 const drain=async()=>{for(let i=0;i<80;i++){const continueButton=page.getByRole('button',{name:'Continue',exact:true});if(await continueButton.count()){await continueButton.click();await page.waitForTimeout(100);continue;}if(await page.getByRole('button',{name:'Dismiss announcement',exact:true}).count()){await page.getByRole('button',{name:'Dismiss announcement',exact:true}).click();await page.waitForTimeout(35);continue;}if(await page.locator('.playing').getAttribute('data-busy')==='true'){await page.waitForTimeout(100);continue;}await page.waitForTimeout(50);if(!await page.getByRole('button',{name:'Dismiss announcement',exact:true}).count())return;}throw new Error('Announcement queue did not drain.');};
 const openProperty=async(name)=>{await page.getByRole('button',{name:`View ${name} property details`,exact:true}).click();await page.getByRole('dialog').waitFor();};
 const close=async()=>page.keyboard.press('Escape');
 const portfolios=async(playerId='player-1')=>{await page.locator(`[data-leaderboard-player="${playerId}"]`).click();await page.getByRole('dialog').waitFor();};
 const history=async()=>{await page.getByRole('button',{name:'Table History',exact:true}).click();await page.getByRole('dialog').waitFor();};
 const roll=async(dice,draw=0)=>{await queue([dice[0]-1,dice[1]-1,draw]);await page.getByRole('button',{name:'Roll Dice',exact:true}).click();};
 await check('reduced-motion moves retain a static landing highlight without replaying it on purchase',async()=>{
  await fixture('landing');await roll([1,2]);
  const tile=page.locator('[data-space-id="3"]');
  await tile.locator('.occupants [data-player-id="player-1"]').waitFor();
  assert.equal(await tile.evaluate(e=>e.classList.contains('landing-highlight')),true);
  assert.equal(await tile.evaluate(e=>getComputedStyle(e).animationName),'none');
  await waitFor(async()=>!await tile.evaluate(e=>e.classList.contains('landing-highlight')));
  await drain();await page.getByRole('button',{name:'Buy for $60',exact:true}).click();
  assert.equal(await tile.evaluate(e=>e.classList.contains('landing-highlight')),false);
 });
 await check('board-first layout and readable 40-space board across nine viewports',async()=>{
  for(const [width,height]of [[1920,1080],[1440,900],[1366,768],[1280,720],[1280,600],[1024,768],[768,1024],[390,844],[320,700]]){
   await page.setViewportSize({width,height});await create(4);
   const report=await page.evaluate(()=>{
    const rect=e=>e.getBoundingClientRect(), spaces=[...document.querySelectorAll('.space')],board=rect(document.querySelector('.board-shell')),canvas=rect(document.querySelector('.board')),panel=rect(document.querySelector('aside'));
    const clipped=spaces.flatMap(s=>[...s.querySelectorAll('.space-name,.space-price,.space-rent,.start-instruction,.occupants,.board-icon')].filter(e=>{if(!e.getClientRects().length)return false;const a=rect(s),b=rect(e);return b.left<a.left-.5||b.top<a.top-.5||b.right>a.right+.5||b.bottom>a.bottom+.5}).map(e=>`${s.textContent}: ${e.classList.value}`));
    const strips=spaces.filter(s=>s.classList.contains('property')).map(s=>{const a=rect(s),b=rect(s.querySelector('.property-color')),edge=s.className.match(/edge-(\w+)/)[1];return edge==='top'?a.bottom-b.bottom:edge==='bottom'?b.top-a.top:edge==='left'?a.right-b.right:b.left-a.left;});
    return {top:board.top,bottom:board.bottom,right:board.right,side:panel.left,panelWidth:panel.width,ratio:canvas.width/canvas.height,pageHeight:document.documentElement.scrollHeight,sidebarScroll:document.querySelector('aside').scrollHeight>document.querySelector('aside').clientHeight+1,setupButton:document.querySelector('.dashboard>.text-button').getBoundingClientRect().bottom,positions:spaces.map(s=>`${s.style.gridRow},${s.style.gridColumn}`),clipped,strips,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(report.positions.length,40);assert.equal(new Set(report.positions).size,40);assert.ok(report.ratio>=1.149&&report.ratio<=1.251,JSON.stringify(report));assert.equal(report.overflow,false);assert.deepEqual(report.clipped,[],`${width}x${height}`);assert.ok(report.strips.every(delta=>Math.abs(delta)<.5));
   if(width>1000){assert.ok(report.top>=0&&report.bottom<=height,JSON.stringify(report));assert.ok(report.side>=report.right);assert.ok(report.panelWidth/width<.24);assert.ok(report.pageHeight<=height+1,JSON.stringify(report));if(height>=720){assert.equal(report.sidebarScroll,false,JSON.stringify(report));assert.ok(report.setupButton<=height,JSON.stringify(report));}}
   assert.equal(await page.locator('.playing .intro,.playing>.header').count(),0);assert.equal(await page.locator('.space-rent').count(),28);assert.equal(await page.getByRole('button',{name:'Player Portfolios',exact:true}).count(),0);assert.equal(await page.locator('.start .occupants .token').count(),4);assert.equal(await page.locator('.space-hit-target').count(),28);
   if(artifactDir)await page.screenshot({path:`${artifactDir}/board-${width}-${height}.png`,fullPage:true});
  }
 });
 await page.setViewportSize({width:1366,height:768});
 await check('larger owner pieces and four shared-space tokens stay inside tiles without covering text',async()=>{
  for(const [width,height]of [[1366,768],[1280,600],[390,844]]){
   await page.setViewportSize({width,height});
   for(const [space,development] of [...[9,11,12,15,28,39,2].map(id=>[id,0]),...[4,'landmark'].flatMap(level=>[9,11,39].map(id=>[id,level]))]){
    await fixture('crowded',space,development);
    const report=await page.evaluate(()=>{
     const visible=[...document.querySelectorAll('.space')];
     const clipped=visible.flatMap(s=>[...s.querySelectorAll('.space-name,.space-price,.space-rent,.occupants,.ownership-marker')].filter(e=>{if(!e.getClientRects().length)return false;const a=s.getBoundingClientRect(),b=e.getBoundingClientRect();return b.left<a.left-.5||b.top<a.top-.5||b.right>a.right+.5||b.bottom>a.bottom+.5}).map(e=>`${s.textContent}: ${e.classList.value}`));
     const overlaps=[];
     const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.75&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.75;
     for(const tile of visible){for(const marker of tile.querySelectorAll('.occupants,.ownership-marker,.development-markers'))for(const text of tile.querySelectorAll('.space-name,.space-price,.space-rent'))if(intersects(marker.getBoundingClientRect(),text.getBoundingClientRect()))overlaps.push(`${tile.dataset.spaceId}: ${marker.className} overlaps ${text.className}`);}
     return {clipped,overlaps,piece:document.querySelector('.occupants .token').getBoundingClientRect().width,owner:document.querySelector('.ownership-marker .token').getBoundingClientRect().width};
    });
    assert.deepEqual(report.clipped,[],`${width}x${height}, space ${space}, development ${development}`);assert.deepEqual(report.overlaps,[],`${width}x${height}, space ${space}, development ${development}`);assert.ok(Math.abs(report.piece-(width>1000&&height<=650&&[11,12,15,39].includes(space)?11.25:14.4))<.1);assert.ok(Math.abs(report.owner-15)<.1);assert.equal(await page.locator(`[data-space-id="${space}"] .occupants .token`).count(),4);
   }
  }await page.setViewportSize({width:1366,height:768});
 });
 await check('eight online pieces fit corner, city, utility, transit and event spaces',async()=>{
  for(const [width,height]of [[1366,768],[1280,600],[390,844]]){
   await page.setViewportSize({width,height});
   for(const id of [0,9,11,12,15,17,28,39,2,36]){
    await page.goto(`${url}/test/fixtures.html?players=8&space=${id}#crowded`);await page.locator('.many-occupants').waitFor();
    const issues=await page.locator('.many-occupants').evaluate(tile=>{
     const a=tile.getBoundingClientRect(),issues=[];const rect=e=>e.getBoundingClientRect();
     for(const e of tile.querySelectorAll('.occupants,.space-name,.space-price,.space-rent,.ownership-marker')){if(!e.getClientRects().length)continue;const b=rect(e);if(b.left<a.left-.5||b.right>a.right+.5||b.top<a.top-.5||b.bottom>a.bottom+.5)issues.push(`outside ${e.className}`);}
     const markers=[...tile.querySelectorAll('.occupants,.ownership-marker')],texts=[...tile.querySelectorAll('.space-name,.space-price,.space-rent')];
     for(const marker of markers)for(const text of texts){const m=rect(marker),t=rect(text);if(Math.min(m.right,t.right)-Math.max(m.left,t.left)>.75&&Math.min(m.bottom,t.bottom)-Math.max(m.top,t.top)>.75)issues.push(`${marker.className} overlaps ${text.className}`);}
     return issues;
    });assert.deepEqual(issues,[],`${width}x${height}, space ${id}`);assert.equal(await page.locator('.many-occupants .occupants .token').count(),8);
   }
  }await page.setViewportSize({width:1366,height:768});
 });
 await check('turn-order modal resolves a tie in place, waits for confirmation and keeps gameplay untouched',async()=>{
  await fixture('order');assert.equal((await state()).turn,0);assert.equal(await page.getByRole('button',{name:'Roll Dice',exact:true}).isDisabled(),true);
  await queue([2,3,4,4,3,2,1,1]);await page.getByRole('button',{name:'Roll for Turn Order',exact:true}).click();await waitFor(async()=>!!(await state()).turnSelection?.history.length&&await page.getByRole('button',{name:'Roll for Turn Order',exact:true}).isEnabled());
  assert.match(await page.getByRole('dialog').innerText(),/Reroll round 2/);await queue([1,2,5,5]);await page.getByRole('button',{name:'Roll for Turn Order',exact:true}).click();await page.getByRole('button',{name:'Start Game',exact:true}).waitFor();
  const before=await state();assert.equal(before.phase,'order-ready');assert.equal(before.turn,0);assert.deepEqual(before.turnOrder,['player-2','player-3','player-1','player-4']);assert.ok(before.players.every(p=>p.position===0&&p.cash===1500));assert.equal(before.dice,null);
  await page.getByRole('button',{name:'Start Game',exact:true}).click();assert.equal((await state()).turn,1);assert.deepEqual(await page.locator('[data-turn-player]').evaluateAll(rows=>rows.map(e=>e.dataset.turnPlayer)),before.turnOrder);
 });
 await check('cash leaderboard opens the selected portfolio and stays distinct from turn order',async()=>{
  await fixture('leaderboard');assert.deepEqual(await page.locator('[data-leaderboard-player]').evaluateAll(rows=>rows.map(e=>e.dataset.leaderboardPlayer)),['player-2','player-1','player-3','player-4']);
  await portfolios('player-2');assert.equal(await page.getByRole('tab',{name:/Atlas/}).getAttribute('aria-selected'),'true');assert.match(await page.getByRole('dialog').innerText(),/Atlas’s portfolio/);await close();const order=await page.locator('[data-turn-player]').evaluateAll(rows=>rows.map(e=>e.dataset.turnPlayer));
  await openProperty('Lisbon');await page.getByRole('button',{name:'Mortgage +$30',exact:true}).click();await close();assert.equal(await page.locator('[data-leaderboard-player]').first().getAttribute('data-leaderboard-player'),'player-1');assert.deepEqual(await page.locator('[data-turn-player]').evaluateAll(rows=>rows.map(e=>e.dataset.turnPlayer)),order);assert.equal(await page.locator('[data-turn-player="player-2"] small').innerText(),'Next');
 });
 await check('live city and utility rents plus one-build UI restrictions reflect engine state',async()=>{
  await fixture('development');assert.equal(await page.locator('[data-space-id="1"] .space-rent').innerText(),'Rent $4');await openProperty('Lisbon');await page.getByRole('button',{name:'Build Development Level 1 · $50',exact:true}).click();assert.match(await page.locator('.development-limit-note').innerText(),/already been built/);await close();assert.equal(await page.locator('[data-space-id="1"] .space-rent').innerText(),'Rent $10');
  await openProperty('Porto');await page.getByRole('button',{name:'Build Development Level 1 · $50',exact:true}).click();await close();await openProperty('Lisbon');assert.equal(await page.getByRole('button',{name:'Build Development Level 2 · $50',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Sell development +$25',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Build Development Level 1 · $50',exact:true}).isDisabled(),true);await close();
  await fixture('ownership');assert.match(await page.locator('[data-space-id="12"] .space-rent').innerText(),/Rent 10× dice/);await openProperty('Lisbon');await page.getByRole('button',{name:'Mortgage +$30',exact:true}).click();await close();assert.match(await page.locator('[data-space-id="1"] .space-rent').innerText(),/Rent \$0/);assert.equal(await page.locator('[data-space-id="1"] .space-rent').getAttribute('aria-label'),'Rent $0 · Mortgaged');
 });
 await check('Rules, portfolio tab navigation, property details and focus return',async()=>{
  await create();const rules=page.getByRole('button',{name:'Rules',exact:true});await rules.click();assert.equal(await page.locator('dialog h3').count(),22);assert.match(await page.getByRole('dialog').innerText(),/third failure/);assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('dialog').evaluate(e=>e.contains(document.activeElement)),true);await close();assert.equal(await rules.evaluate(e=>e===document.activeElement),true);
  await portfolios();assert.equal(await page.getByRole('tab').count(),2);await page.getByRole('tab',{name:/Taylor/}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:/Atlas/}).getAttribute('aria-selected'),'true');await close();
  await openProperty('Lisbon');assert.match(await page.getByRole('dialog').innerText(),/Rent schedule/);assert.match(await page.getByRole('dialog').innerText(),/Landmark/);assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^Mortgage/}).isDisabled(),true);await close();assert.equal(await page.getByRole('button',{name:'View Lisbon property details'}).evaluate(e=>e===document.activeElement),true);
 });
 await check('purchase, mortgage, bank redemption and full categorized history',async()=>{
  await create();await roll([1,2]);await drain();await page.getByRole('button',{name:'Buy for $60',exact:true}).click();await drain();assert.equal(await page.locator('[data-space-id="3"] .ownership-marker .token').count(),1);
  await openProperty('Porto');await page.getByRole('button',{name:'Mortgage +$30',exact:true}).click();await close();await page.getByRole('button',{name:'Bank',exact:true}).click();assert.match(await page.getByRole('dialog').innerText(),/Outstanding principal/);assert.match(await page.getByRole('dialog').innerText(),/Porto/);await page.getByRole('button',{name:'Unmortgage $33',exact:true}).click();assert.match(await page.getByRole('dialog').innerText(),/No properties are currently mortgaged/);await close();
  await history();await page.getByLabel('Event category').selectOption('mortgages');assert.equal(await page.locator('.event-log li').count(),2);assert.match(await page.getByRole('dialog').innerText(),/including interest/);await close();
 });
 await check('bots roll, pay rent, pause for Rules and return control without duplicate rolls',async()=>{
  await create();await roll([1,2]);await drain();await page.getByRole('button',{name:'Buy for $60',exact:true}).click();await drain();assert.equal(await page.getByRole('button',{name:'Roll Dice',exact:true}).isDisabled(),true);
  await queue([0,1,0]);await page.getByRole('button',{name:'End Turn',exact:true}).click();await page.getByRole('button',{name:'Rules',exact:true}).click();await page.waitForTimeout(1000);await close();
  await waitFor(async()=>{await drain();return page.getByRole('button',{name:'Roll Dice',exact:true}).isEnabled();});
  await history();await page.getByLabel('Event category').selectOption('rent');assert.match(await page.getByRole('dialog').innerText(),/pays \$4 to Taylor for rent at Porto/);await close();assert.equal(await page.locator('[data-space-id="3"] .occupants .token').count(),2);
 });
 await check('ownership tokens, city/transit/utility tints, grouped portfolios and read-only rivals',async()=>{
  await fixture('ownership');const color=async(id)=>page.locator(`[data-space-id="${id}"]`).evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(await color(1),await color(3));assert.equal(await color(5),await color(15));assert.equal(await color(25),await color(35));assert.notEqual(await color(5),await color(25));assert.equal(await color(12),await color(28));assert.notEqual(await color(12),await color(1));if(artifactDir)await page.screenshot({path:`${artifactDir}/ownership.png`,fullPage:true});
  assert.equal(await page.locator('.ownership-marker .token').count(),9);await portfolios();assert.match(await page.locator('.portfolio-group').first().innerText(),/2 \/ 2.*Complete/);await page.getByRole('tab',{name:/Atlas/}).click();assert.match(await page.getByRole('dialog').innerText(),/utility/i);await page.locator('.property-row').filter({hasText:'Power'}).click();assert.equal(await page.getByRole('button',{name:'Mortgage +$75',exact:true}).isDisabled(),true);await close();
 });
 await check('reviewed trade updates ownership, tint and actual-rent collection announcements',async()=>{
  await fixture('ownership');const before=await page.locator('[data-space-id="1"]').evaluate(e=>getComputedStyle(e).backgroundColor);
  await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('checkbox',{name:/^Porto/}).check();await page.getByRole('button',{name:'Review trade',exact:true}).click();await page.getByRole('button',{name:'Approve & send',exact:true}).click();await drain();await waitFor(async()=>{await drain();return (await state()).ownership[3]==='player-2';});await drain();assert.notEqual(await page.locator('[data-space-id="1"]').evaluate(e=>getComputedStyle(e).backgroundColor),before);
  await history();assert.match(await page.getByRole('dialog').innerText(),/no longer owns the complete clay/);assert.match(await page.getByRole('dialog').innerText(),/accepts/);await close();
 });
 await check('Landmark building, compact diamond, downgrade refund and rent schedule',async()=>{
  await fixture('landmark');await openProperty('Lisbon');await page.getByRole('button',{name:'Build Landmark · $50',exact:true}).click();assert.equal((await state()).properties[1].landmark,true);assert.match(await page.getByRole('dialog').innerText(),/Constructed/);assert.equal(await page.getByRole('button',{name:'Mortgage +$30',exact:true}).isDisabled(),true);await close();assert.equal(await page.locator('[data-space-id="1"] .development-markers.landmark').count(),1);
  await openProperty('Lisbon');await page.getByRole('button',{name:'Sell Landmark +$25',exact:true}).click();assert.equal((await state()).properties[1].landmark,false);assert.equal((await state()).properties[1].level,4);await close();assert.equal(await page.locator('[data-space-id="1"] .development-markers i').count(),4);
 });
 await check('detention payment, card use, doubles, failure and mandatory third payment',async()=>{
  await fixture('detention');await page.getByRole('button',{name:'Pay $50',exact:true}).click();assert.equal((await state()).players[0].cash,1450);assert.equal(await page.getByRole('button',{name:'Roll Dice',exact:true}).isEnabled(),true);
  await fixture('detention');await page.getByRole('button',{name:/Use Get Out of Trouble/}).click();assert.equal((await state()).players[0].troubleCards,0);
  await fixture('detention');await queue([1,1,0]);await page.getByRole('button',{name:'Attempt doubles',exact:true}).click();assert.equal((await state()).players[0].position,14);assert.equal((await state()).players[0].detained,false);assert.equal((await state()).phase,'purchase');
  await fixture('detention');await queue([0,1,0]);await page.getByRole('button',{name:'Attempt doubles',exact:true}).click();assert.equal((await state()).players[0].detentionAttempts,1);await portfolios();assert.match(await page.getByRole('dialog').innerText(),/2 doubles attempts remaining/);await close();
  await fixture('third-attempt');await queue([0,1,0]);await page.getByRole('button',{name:'Attempt doubles',exact:true}).click();assert.equal((await state()).players[0].cash,1450);assert.equal((await state()).players[0].position,13);
 });
 await check('queued card announcements reveal original text, inventory and real opponent transfers',async()=>{
  await fixture('treasure-release');await roll([1,2],5);await page.locator('.drawn-card').waitFor();assert.match(await page.getByRole('dialog').innerText(),/Community guarantor/);assert.match(await page.locator('.drawn-card').innerText(),/Get Out of Trouble/);await drain();await portfolios();assert.match(await page.getByRole('dialog').innerText(),/Get Out of Trouble cards: 1/);await close();
  await fixture('treasure-collect');await roll([1,2],6);await drain();await portfolios();assert.match(await page.getByRole('dialog').innerText(),/\$1,530/);await close();await history();await page.getByLabel('Event category').selectOption('cards');assert.match(await page.getByRole('dialog').innerText(),/Neighborhood supper/);assert.equal(await page.locator('.event-log li').count(),4);await close();
 });
 await check('earned doubles roll is available while End Turn remains disabled',async()=>{
  await fixture('extra-roll');assert.equal(await page.getByRole('button',{name:'Roll Dice',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'End Turn',exact:true}).isDisabled(),true);await roll([1,2]);await drain();assert.equal((await state()).players[0].position,23);assert.equal(await page.getByRole('button',{name:'End Turn',exact:true}).isEnabled(),true);
 });
 await check('human and bots bid/pass in the existing table auction with atomic ownership',async()=>{
  await fixture('auction');await page.getByRole('dialog',{name:/Auction/}).waitFor();await page.getByLabel('Your bid').fill('0');assert.equal(await page.getByRole('button',{name:'Bid $0',exact:true}).isDisabled(),true);await page.getByLabel('Your bid').fill('30');await page.getByRole('button',{name:'Bid $30',exact:true}).click();await waitFor(()=>page.getByRole('button',{name:'Pass auction',exact:true}).isEnabled());await page.getByRole('button',{name:'Pass auction',exact:true}).click();await waitFor(async()=>await page.getByRole('dialog',{name:/Auction/}).count()===0);await drain();const result=await state();assert.ok(result.ownership[1]&&result.ownership[1]!=='player-1');assert.ok(result.players.find(p=>p.id===result.ownership[1]).cash<1500);assert.equal(result.players[0].cash,1500);
 });
 await check('inherited mortgages offer principal-only redemption or retention after immediate interest',async()=>{
  await fixture('inheritance');await page.getByRole('dialog',{name:'Inherited mortgages',exact:true}).waitFor();assert.equal((await state()).players[0].cash,1497);await page.getByRole('button',{name:'Redeem now $30',exact:true}).click();assert.equal((await state()).properties[1].mortgaged,false);assert.equal((await state()).players[0].cash,1467);await fixture('inheritance');await page.getByRole('button',{name:'Keep mortgage',exact:true}).click();assert.equal((await state()).properties[1].mortgaged,true);assert.equal((await state()).players[0].cash,1497);
 });
 await check('a human debtor can sell a property for cash and return to Pay debt',async()=>{
  await fixture('debt-trade');await page.getByRole('button',{name:'Trade',exact:true}).click();await page.getByRole('checkbox',{name:/^Lisbon/}).check();await page.getByLabel('Cash you request').fill('30');await page.getByRole('button',{name:'Review trade',exact:true}).click();await page.getByRole('button',{name:'Approve & send',exact:true}).click();await waitFor(async()=>{await drain();return (await state()).phase==='debt'&&(await state()).ownership[1]==='player-2';});await page.getByRole('button',{name:'Pay debt',exact:true}).click();assert.equal((await state()).players[0].cash,20);assert.equal((await state()).acting,'player-2');
 });
 await check('ordinary announcements auto-dismiss while purchase cards remain until resolved',async()=>{
  await create();await roll([2,2]);await page.locator('.announcement-player').first().waitFor();assert.equal(await page.locator('.announcement-player').first().innerText(),'Taylor');await page.getByRole('button',{name:'Dismiss announcement',exact:true}).click();await page.locator('.announcement-amount').first().waitFor();assert.equal(await page.locator('.announcement-amount').first().innerText(),'$200');assert.ok(await page.locator('.announcement-amount').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
  await create();await roll([1,2]);await page.getByRole('button',{name:'Dismiss announcement',exact:true}).waitFor();await page.waitForTimeout(3200);assert.equal(await page.getByRole('button',{name:'Dismiss announcement',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Buy for $60',exact:true}).count(),1);await page.waitForTimeout(3200);assert.equal(await page.getByRole('button',{name:'Buy for $60',exact:true}).count(),1);await page.getByRole('button',{name:'Decline',exact:true}).click();await page.getByRole('button',{name:'Pass auction',exact:true}).click();await waitFor(async()=>{await drain();return await page.getByRole('dialog',{name:/Auction/}).count()===0;});await drain();assert.equal(await page.getByRole('button',{name:'End Turn',exact:true}).isEnabled(),true);
 });
 await check('sequential movement and dice lock actions, crossing and inspection use authoritative outcomes',async()=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture('crossing');await queue([0,1,0]);await page.getByRole('button',{name:'Roll Dice',exact:true}).click();await page.locator('.die.rolling').first().waitFor();assert.equal(await page.getByRole('button',{name:'End Turn',exact:true}).isDisabled(),true);assert.equal((await state()).players[0].position,1);
  await waitFor(async()=>await page.locator('.die.rolling').count()===0);assert.equal(await page.getByRole('img',{name:'Die: 1',exact:true}).count(),1);assert.equal(await page.getByRole('img',{name:'Die: 2',exact:true}).count(),1);await page.waitForTimeout(600);assert.equal(await page.locator('.occupants [data-player-id="player-1"]').evaluate(e=>e.closest('[data-space-id]').getAttribute('data-space-id')),'38');assert.match(await page.locator('.current-cash').innerText(),/1,500/);
  const positions=[];for(let i=0;i<70;i++){const value=await page.evaluate(()=>document.querySelector('.occupants [data-player-id="player-1"]')?.closest('[data-space-id]')?.getAttribute('data-space-id')??null);if(value!==null)positions.push(Number(value));if(await page.locator('.playing').getAttribute('data-busy')==='false')break;await page.waitForTimeout(45);}
  assert.ok(positions.includes(39)&&positions.includes(0)&&positions.includes(1),JSON.stringify(positions));assert.equal((await state()).players[0].cash,1700);await drain();assert.equal(await page.getByRole('button',{name:'Buy for $60',exact:true}).count(),1);
  await fixture('detour');await roll([1,1]);await waitFor(async()=>await page.locator('.playing').getAttribute('data-busy')==='false');assert.equal((await state()).players[0].position,10);assert.equal((await state()).players[0].cash,1500);assert.equal((await state()).players[0].detained,true);
  await page.emulateMedia({reducedMotion:'reduce'});await fixture('crossing');await roll([1,2]);assert.equal(await page.locator('.die.rolling').count(),0);assert.equal(await page.locator('.occupants [data-player-id="player-1"]').evaluate(e=>e.closest('[data-space-id]').getAttribute('data-space-id')),'1');
 });
 await check('mobile announcements remain readable and inside the visible board frame',async()=>{
  await page.setViewportSize({width:320,height:700});await create();await roll([1,2]);await page.getByRole('button',{name:'Dismiss announcement',exact:true}).waitFor();
  const bounds=await page.locator('.announcement-card').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};});assert.ok(bounds.left>=0&&bounds.right<=320,JSON.stringify(bounds));await drain();assert.equal(await page.getByRole('button',{name:'Buy for $60',exact:true}).isVisible(),true);await page.setViewportSize({width:1366,height:768});
 });
 await check('liquidation, explicit settlement and bankruptcy/victory preserve prior gameplay',async()=>{
  await fixture('liquidation');await drain();await openProperty('Lisbon');await page.getByRole('button',{name:'Mortgage +$30',exact:true}).click();await close();await openProperty('Porto');await page.getByRole('button',{name:'Mortgage +$30',exact:true}).click();await close();await page.getByRole('button',{name:'Pay debt',exact:true}).click();assert.equal((await state()).players[0].cash,20);
  await fixture('bankruptcy');await page.getByRole('button',{name:'Declare bankruptcy',exact:true}).click();await drain();assert.match(await page.getByRole('dialog').innerText(),/Atlas wins/);await page.getByRole('button',{name:'New Game',exact:true}).click();assert.equal((await state()).phase,'turn-order');assert.equal((await state()).turn,0);await fixture('bankruptcy');await page.getByRole('button',{name:'Declare bankruptcy',exact:true}).click();await drain();await page.getByRole('dialog').getByRole('button',{name:'Return to Setup',exact:true}).click();assert.match(await page.locator('body').innerText(),/Returned to setup/);
 });
 assert.deepEqual(errors,[]);console.log(`${checks} browser checks passed.`);
} catch(error){
 if(lastPage&&!lastPage.isClosed()){console.error('Browser failure state:',JSON.stringify({url:lastPage.url(),body:(await lastPage.locator('body').innerText()).slice(0,800)}));if(artifactDir)await lastPage.screenshot({path:`${artifactDir}/failure.png`,fullPage:true});}
 throw error;
} finally {
 await browser?.close();
 if(process.platform==='win32')server.kill();else try{process.kill(-server.pid,'SIGTERM');}catch{}
}

import {passAll} from './helpers.mjs';
import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,chooseBotAction,finances,calculateRent} from '../.test-build/index.js';
const setup=(count=3)=>createGame({humanName:'Taylor',token:'circle',playerCount:count});
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('human can raise funds and settle debt before bankruptcy',()=>{
 let s=setup();s.ownership={1:'player-1',3:'player-1'};s.players[0].cash=160;s=run(s,{type:'ROLL',dice:[2,2],cardDraw:0});assert.equal(s.phase,'debt');assert.equal(s.players[0].cash,160);
 assert.throws(()=>run(s,{type:'BANKRUPT'}),/Raise funds/);assert.throws(()=>run(s,{type:'END_TURN'}));
 s=run(s,{type:'MORTGAGE',propertyId:1});s=run(s,{type:'MORTGAGE',propertyId:3});s=run(s,{type:'SETTLE_DEBT'});assert.equal(s.players[0].cash,20);assert.equal(s.phase,'actions');assert.equal(s.debt,null);
});
test('bankruptcy to bank clears assets, skips eliminated players, blocks actions',()=>{
 let s=setup();s.players[0].cash=0;s.ownership[1]='player-1';s.properties[1]={level:0,mortgaged:true};s=run(s,{type:'ROLL',dice:[2,2],cardDraw:0});s=run(s,{type:'BANKRUPT'});
 assert.equal(s.phase,'auction');assert.ok(!s.auction.participants.includes('player-1'));s=passAll(s);assert.equal(s.players[0].bankrupt,true);assert.equal(s.currentPlayerIndex,1);assert.equal(s.ownership[1],undefined);assert.equal(s.properties[1],undefined);
 assert.throws(()=>run(s,{actorId:'player-1',type:'ROLL',dice:[1,2],cardDraw:0}),/Eliminated/);
 s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});s=passAll(run(s,{type:'DECLINE'}));s=run(s,{type:'END_TURN'});assert.equal(s.currentPlayerIndex,2);
 s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});s=passAll(run(s,{type:'DECLINE'}));s=run(s,{type:'END_TURN'});assert.equal(s.currentPlayerIndex,1);
});
test('creditor receives assets and winner ends all actions',()=>{
 let s=setup(2);s.ownership={1:'player-1',3:'player-2',39:'player-2'};s.properties[1]={level:0,mortgaged:true};s.properties[3]={level:4,mortgaged:false};s.players[0].cash=1;
 const rent=calculateRent(s,3);assert.ok(rent>1);s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});s=run(s,{type:'BANKRUPT'});
 assert.equal(s.ownership[1],'player-2');assert.equal(s.properties[1].mortgaged,true);assert.equal(s.players[1].cash,1498);assert.equal(s.phase,'inheritance');s=applyAction(s,{type:'KEEP_INHERITED',propertyId:1,actorId:'player-2',expectedRevision:s.revision});assert.equal(s.phase,'finished');assert.equal(s.winnerId,'player-2');
 assert.throws(()=>run(s,{type:'END_TURN'}),/ended/);
});
test('bot liquidates evenly, mortgages and settles an affordable debt',()=>{
 let s=setup();s.currentPlayerIndex=1;s.players[1].cash=50;s.players[1].position=1;s.ownership={1:'player-2',3:'player-2'};s.properties={1:{level:2,mortgaged:false},3:{level:2,mortgaged:false}};
 s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});assert.equal(s.phase,'debt');
 let steps=0;while(s.phase==='debt'&&steps++<20){const a=chooseBotAction(s,{dice:[1,2],cardDraw:0});assert.ok(a);s=applyAction(s,a);}
 assert.equal(s.phase,'actions');assert.equal(s.players[1].cash,10);assert.equal(s.players[1].bankrupt,false);
});
test('inspection starts a detained turn instead of skipping the player',()=>{let s=setup();s.players[1].detained=true;s.phase='actions';s=run(s,{type:'END_TURN'});assert.equal(s.currentPlayerIndex,1);assert.equal(s.phase,'detention');});
test('long deterministic bot simulation maintains financial and ownership invariants',()=>{
 for(let seed=1;seed<=8;seed++) {
  let value=seed;const rand=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value;};
  let s=setup(4);s.players.forEach((p,i)=>{p.isBot=true;p.strategy=['strategic','conservative','aggressive','strategic'][i];});
  for(let step=0;step<3000&&s.phase!=='finished';step++) {
   const a=chooseBotAction(s,{dice:[rand()%6+1,rand()%6+1],cardDraw:rand()});assert.ok(a,`no bot action in ${s.phase}`);
   const prior=s;s=applyAction(s,a);assert.equal(s.revision,prior.revision+1);
   for(const p of s.players){assert.ok(Number.isSafeInteger(p.cash)&&p.cash>=0);assert.ok(p.position>=0&&p.position<40);assert.ok(Number.isFinite(finances(s,p.id).netWorth));}
   for(const [id,owner]of Object.entries(s.ownership)){assert.ok(s.spaces[+id].price);assert.ok(s.players.some(p=>p.id===owner&&!p.bankrupt));}
   for(const status of Object.values(s.properties)){assert.ok(status.level>=0&&status.level<=4);assert.ok(!status.mortgaged||status.level===0);}
  }
 }
});
test('settling a rent debt credits the creditor exactly once, human can win',()=>{
 let s=setup(2);s.ownership={1:'player-1',3:'player-2'};s.players[0].cash=0;
 s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});const rent=s.debt.amount;s=run(s,{type:'MORTGAGE',propertyId:1});const cash=s.players[1].cash;s=run(s,{type:'SETTLE_DEBT'});assert.equal(s.players[1].cash,cash+rent);assert.throws(()=>run(s,{type:'SETTLE_DEBT'}));
 s=setup(2);s.currentPlayerIndex=1;s.players[1].cash=0;s=run(s,{type:'ROLL',dice:[2,2],cardDraw:0});s=run(s,{type:'BANKRUPT'});assert.equal(s.winnerId,'player-1');assert.equal(s.currentPlayerIndex,0);
});

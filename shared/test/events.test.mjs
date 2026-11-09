import {forceNextCard} from './helpers.mjs';
import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,actingPlayer,formatGameEvent,chooseBotAction} from '../.test-build/index.js';
const setup=()=>createGame({humanName:'Taylor',token:'circle',playerCount:3});
const run=(s,a)=>applyAction(s,{actorId:actingPlayer(s).id,expectedRevision:s.revision,...a});
test('events carry structured movement, dice, transactions and chronological sequence',()=>{
 let s=setup();s.players[0].position=38;s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});s=run(s,{type:'BUY'});
 assert.ok(s.log.find(e=>e.dice));assert.deepEqual(s.log.find(e=>e.movement).movement.path,[39,0,1]);
 assert.ok(s.log.some(e=>e.category==='purchases'&&e.propertyTransfers[0].propertyId===1));
 assert.ok(s.log.every((e,i)=>i===0||s.log[i-1].id>e.id));assert.ok(s.log.every(e=>e.actorId&&formatGameEvent(e)===e.message));
});
test('multi-opponent cards actually collect and pay every active opponent',()=>{
 for(const [deck,id,delta] of [['Treasure','treasure-09',10],['Luck','luck-15',-50]]){
 let s=setup();forceNextCard(s,deck,id);s.players[0].position=deck==='Luck'?4:14;s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});assert.equal(s.players[0].cash,1500+delta*2);assert.equal(s.players[1].cash,1500-delta);assert.equal(s.players[2].cash,1500-delta);assert.equal(s.phase,'actions');
 assert.equal(s.log.filter(e=>e.cashTransfers).reduce((n,e)=>n+e.cashTransfers.length,0),2);
 }
});
test('opponent debt interrupts a card, can liquidate out of turn, and resumes remaining payments exactly once',()=>{
 let s=setup();s.players[1].cash=0;s.ownership[1]='player-2';forceNextCard(s,'Treasure','treasure-09');s=run(s,{type:'ROLL',dice:[1,1],cardDraw:6});assert.equal(s.phase,'debt');assert.equal(actingPlayer(s).id,'player-2');assert.equal(s.currentPlayerIndex,0);
 assert.equal(chooseBotAction(s,{dice:[1,2],cardDraw:0}).type,'MORTGAGE');s=run(s,{type:'MORTGAGE',propertyId:1});s=run(s,{type:'SETTLE_DEBT'});assert.equal(s.players[0].cash,1520);assert.equal(s.players[1].cash,20);assert.equal(s.players[2].cash,1490);assert.equal(s.phase,'actions');
});
test('group gain/loss announcements contain the actual recalculated rents',()=>{
 let s=setup();s.ownership[1]='player-1';s.players[0].position=1;s=run(s,{type:'ROLL',dice:[1,1],cardDraw:0});s=run(s,{type:'BUY'});
 const group=s.log.find(e=>e.category==='groups');assert.match(group.message,/doubled/);assert.deepEqual(group.rents.map(r=>r.amount),[4,8]);
 s=run(s,{type:'PROPOSE_TRADE',offer:{partnerId:'player-2',offeredProperties:[3],requestedProperties:[],offeredCash:0,requestedCash:0}});s=applyAction(s,{type:'ACCEPT_TRADE',actorId:'player-2',expectedRevision:s.revision,tradeId:s.trade.id});assert.ok(s.log.some(e=>e.category==='groups'&&/no longer/.test(e.message)));
});
test('a human debtor can settle a bot card out of turn without receiving the turn',()=>{
 let s=setup();s.currentPlayerIndex=1;s.players[0].cash=0;s.ownership[1]='player-1';forceNextCard(s,'Treasure','treasure-09');s=run(s,{type:'ROLL',dice:[1,1],cardDraw:6});assert.equal(actingPlayer(s).id,'player-1');assert.throws(()=>run(s,{type:'END_TURN'}));s=run(s,{type:'MORTGAGE',propertyId:1});s=run(s,{type:'SETTLE_DEBT'});assert.equal(s.currentPlayerIndex,1);assert.equal(s.phase,'actions');assert.equal(s.players[1].cash,1520);
});
test('a bankrupt opponent does not block the remaining card payments',()=>{
 let s=setup();s.players[1].cash=0;forceNextCard(s,'Treasure','treasure-09');s=run(s,{type:'ROLL',dice:[1,1],cardDraw:6});s=run(s,{type:'BANKRUPT'});assert.equal(s.players[1].bankrupt,true);assert.equal(s.players[0].cash,1510);assert.equal(s.players[2].cash,1490);assert.equal(s.phase,'actions');
});
test('rejected actions are recorded without changing finances or turn authority',async()=>{
 const {recordRejectedAction}=await import('../.test-build/index.js');const s=setup(),next=recordRejectedAction(s,'player-1','Insufficient cash.');assert.equal(s.log.length,1);assert.equal(next.log.length,2);assert.deepEqual(next.players,s.players);assert.equal(next.revision,s.revision);assert.equal(next.log[0].category,'penalties');
});

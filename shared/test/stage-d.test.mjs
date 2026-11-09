import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,chooseBotAction,botAcceptsTrade} from '../.test-build/index.js';
const setup=()=>{const s=createGame({humanName:'Taylor',token:'circle',playerCount:4});s.phase='actions';s.ownership={1:'player-1',3:'player-2',5:'player-2'};return s;};
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
const offer={partnerId:'player-2',offeredProperties:[1],requestedProperties:[3],offeredCash:100,requestedCash:10};
test('trades are atomic, require both approvals and preserve mortgage status',()=>{
 let s=setup();s.properties[1]={level:0,mortgaged:true};const before=structuredClone(s);
 s=run(s,{type:'PROPOSE_TRADE',offer});assert.deepEqual(s.ownership,before.ownership);assert.equal(s.players[0].cash,1500);
 assert.throws(()=>run(s,{type:'ACCEPT_TRADE',tradeId:s.trade.id}),/participant/);
 const accepted=run(s,{type:'ACCEPT_TRADE',tradeId:s.trade.id,actorId:'player-2'});
 assert.equal(accepted.ownership[1],'player-2');assert.equal(accepted.ownership[3],'player-1');assert.equal(accepted.players[0].cash,1410);assert.equal(accepted.players[1].cash,1590);assert.equal(accepted.properties[1].mortgaged,true);
 assert.throws(()=>run(accepted,{type:'ACCEPT_TRADE',tradeId:s.trade.id,actorId:'player-2'}));
});
test('invalid trades reject wrong owners, duplicate ids, upgrades, invalid cash and bankruptcy',()=>{
 for(const change of [{requestedProperties:[6]},{offeredProperties:[1,1]},{offeredProperties:[1],requestedProperties:[1]},{offeredCash:1600},{offeredCash:-1},{offeredCash:.5},{offeredCash:NaN},{partnerId:'player-1'}])assert.throws(()=>run(setup(),{type:'PROPOSE_TRADE',offer:{...offer,...change}}));
 let s=setup();s.properties[1]={level:1,mortgaged:false};assert.throws(()=>run(s,{type:'PROPOSE_TRADE',offer}),/upgrades/);
 s=setup();s.players[1].bankrupt=true;assert.throws(()=>run(s,{type:'PROPOSE_TRADE',offer}));
});
test('bot strategies respect human turns and evaluate trades instead of always accepting',()=>{
 const s=setup();assert.equal(chooseBotAction(s,{dice:[1,2],cardDraw:0}),null);
 assert.equal(botAcceptsTrade(s,'player-1',{...offer,offeredProperties:[],offeredCash:0,requestedProperties:[5],requestedCash:100}),false);
 assert.equal(botAcceptsTrade(s,'player-1',{...offer,offeredCash:500,requestedCash:0}),true);
 for(const index of [1,2,3]){s.currentPlayerIndex=index;s.phase='awaiting-roll';assert.equal(chooseBotAction(s,{dice:[1,2],cardDraw:0}).actorId,s.players[index].id);}
});
test('recipient approval revalidates the proposal and rejection changes no assets',()=>{
 let s=run(setup(),{type:'PROPOSE_TRADE',offer});const prior=structuredClone(s);
 const rejected=run(s,{type:'REJECT_TRADE',actorId:'player-2',tradeId:s.trade.id});assert.deepEqual(rejected.ownership,prior.ownership);assert.deepEqual(rejected.players,prior.players);assert.equal(rejected.phase,'actions');
 s.players[1].cash=0;assert.throws(()=>run(s,{type:'ACCEPT_TRADE',actorId:'player-2',tradeId:s.trade.id}),/insufficient/);
 s=run(setup(),{type:'PROPOSE_TRADE',offer});delete s.ownership[1];assert.throws(()=>run(s,{type:'ACCEPT_TRADE',actorId:'player-2',tradeId:s.trade.id}),/ownership/);
});

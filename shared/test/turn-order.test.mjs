import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,nextOrderRoller,chooseBotAction,activePlayer,nextTurnPlayer} from '../.test-build/index.js';
const setup=(count=4)=>createGame({humanName:'Taylor',token:'circle',playerCount:count});
const roll=(s,dice)=>applyAction(s,{type:'ROLL_ORDER',actorId:nextOrderRoller(s).id,expectedRevision:s.revision,dice});
const start=s=>applyAction(s,{type:'START_GAME',actorId:'player-1',expectedRevision:s.revision});
const run=(s,a)=>applyAction(s,{actorId:activePlayer(s).id,expectedRevision:s.revision,...a});
test('initial rolls are separate, highest plays first, and gameplay waits for confirmation',()=>{
 let s=setup();assert.equal(s.phase,'turn-order');assert.equal(s.turn,0);assert.deepEqual(s.turnOrder,[]);const before=structuredClone(s);
 for(const action of [{type:'ROLL',dice:[1,2],cardDraw:0},{type:'END_TURN'},{type:'BUY'},{type:'MORTGAGE',propertyId:1},{type:'START_GAME'}])assert.throws(()=>run(s,action));
 for(const dice of [[3,4],[5,5],[2,3],[1,2]])s=roll(s,dice);
 assert.deepEqual(s.turnOrder,['player-2','player-1','player-3','player-4']);assert.equal(s.phase,'order-ready');assert.equal(s.turn,0);assert.equal(s.dice,null);assert.deepEqual(s.players.map(p=>[p.position,p.cash]),before.players.map(p=>[p.position,p.cash]));assert.deepEqual(s.ownership,{});
 assert.equal(chooseBotAction(s,{dice:[1,2],cardDraw:0}),null);assert.throws(()=>run(s,{type:'ROLL',dice:[1,2],cardDraw:0}));
 s=start(s);assert.equal(activePlayer(s).id,'player-2');assert.equal(s.turn,1);assert.equal(s.phase,'awaiting-roll');assert.equal(s.turnSelection,null);
});
test('two-player tie rerolls only tied players within their original slot',()=>{
 let s=setup();for(const dice of [[5,5],[3,4],[4,3],[2,2]])s=roll(s,dice);
 assert.equal(nextOrderRoller(s).id,'player-2');s=roll(s,[6,6]);s=roll(s,[5,5]);assert.deepEqual(s.turnOrder,['player-1','player-2','player-3','player-4']);assert.equal(s.turnSelection.history.filter(r=>r.playerId==='player-1').length,1);assert.equal(s.turnSelection.history.filter(r=>r.playerId==='player-4').length,1);
});
test('three-way and repeated ties resolve recursively without displacing settled players',()=>{
 let s=setup();for(const dice of [[3,3],[3,3],[3,3],[1,1]])s=roll(s,dice);
 for(const dice of [[5,5],[5,5],[3,3]])s=roll(s,dice);assert.equal(nextOrderRoller(s).id,'player-1');
 s=roll(s,[4,4]);s=roll(s,[4,4]);assert.equal(nextOrderRoller(s).id,'player-1');s=roll(s,[1,2]);s=roll(s,[6,6]);assert.deepEqual(s.turnOrder,['player-2','player-1','player-3','player-4']);assert.equal(new Set(s.turnOrder).size,4);
});
test('separate tied score groups keep their relative blocks despite larger later totals',()=>{
 let s=setup();for(const dice of [[5,5],[5,5],[1,1],[1,1]])s=roll(s,dice);s=roll(s,[1,1]);s=roll(s,[1,2]);s=roll(s,[6,6]);s=roll(s,[5,5]);assert.deepEqual(s.turnOrder,['player-2','player-1','player-3','player-4']);
});
test('roll authority, invalid dice, stale rolls and duplicate confirmation are rejected',()=>{
 let s=setup(2);assert.throws(()=>applyAction(s,{type:'ROLL_ORDER',actorId:'player-2',expectedRevision:0,dice:[1,2]}));assert.throws(()=>roll(s,[0,7]));assert.throws(()=>roll(s,new Array(2)));const action={type:'ROLL_ORDER',actorId:'player-1',expectedRevision:0,dice:[5,5]};s=applyAction(s,action);assert.throws(()=>applyAction(s,action),/stale/);assert.equal(chooseBotAction(s,{dice:[2,3],cardDraw:0}).type,'ROLL_ORDER');s=roll(s,[2,3]);s=start(s);assert.throws(()=>start(s));
});
test('the finalized sequence remains fixed during financial changes and skips bankrupt seats',()=>{
 let s=setup();for(const dice of [[3,4],[5,5],[2,3],[1,2]])s=roll(s,dice);s=start(s);const order=[...s.turnOrder];s.players[0].bankrupt=true;s.players[0].cash=9999;
 assert.equal(nextTurnPlayer(s).id,'player-3');s.phase='actions';s=run(s,{type:'END_TURN'});assert.equal(activePlayer(s).id,'player-3');assert.deepEqual(s.turnOrder,order);assert.equal(s.players[0].id,'player-1');
});

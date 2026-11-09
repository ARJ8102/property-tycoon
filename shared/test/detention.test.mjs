import {forceNextCard,giveRelease} from './helpers.mjs';
import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,chooseBotAction} from '../.test-build/index.js';
const setup=()=>{const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.players[0].detained=true;s.players[0].position=10;s.phase='detention';return s;};
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('paying and using an inventory card release without using the roll',()=>{
 let s=run(setup(),{type:'PAY_RELEASE'});assert.equal(s.phase,'awaiting-roll');assert.equal(s.players[0].cash,1450);assert.equal(s.players[0].detained,false);
 s=setup();giveRelease(s,0);s=run(s,{type:'USE_TROUBLE_CARD'});assert.equal(s.players[0].troubleCards,0);assert.equal(s.phase,'awaiting-roll');assert.equal(s.players[0].cash,1500);
});
test('doubles release and move, no extra roll; failed attempts end the turn',()=>{
 let s=run(setup(),{type:'ROLL_DETENTION',dice:[2,2],cardDraw:0});assert.equal(s.players[0].position,14);assert.equal(s.players[0].detained,false);assert.equal(s.phase,'purchase');assert.throws(()=>run(s,{type:'ROLL',dice:[1,2],cardDraw:0}));
 s=run(setup(),{type:'ROLL_DETENTION',dice:[1,2],cardDraw:0});assert.equal(s.players[0].position,10);assert.equal(s.players[0].detentionAttempts,1);assert.equal(s.currentPlayerIndex,1);
});
test('third failure charges $50 and resolves that roll, with liquidation when necessary',()=>{
 let s=setup();s.players[0].detentionAttempts=2;s=run(s,{type:'ROLL_DETENTION',dice:[1,2],cardDraw:0});assert.equal(s.players[0].cash,1450);assert.equal(s.players[0].position,13);assert.equal(s.phase,'purchase');
 s=setup();s.players[0].detentionAttempts=2;s.players[0].cash=0;s.ownership={1:'player-1',3:'player-1'};s=run(s,{type:'ROLL_DETENTION',dice:[1,2],cardDraw:0});assert.equal(s.phase,'debt');assert.equal(s.players[0].position,10);
 s=run(s,{type:'MORTGAGE',propertyId:1});s=run(s,{type:'MORTGAGE',propertyId:3});s=run(s,{type:'SETTLE_DEBT'});assert.equal(s.players[0].position,13);assert.equal(s.players[0].cash,10);assert.equal(s.phase,'purchase');assert.equal(s.players[0].detained,false);
});
test('detained players need release before normal rolls and cannot end early; bots use release options',()=>{
 const s=setup();for(const a of [{type:'ROLL',dice:[1,2],cardDraw:0},{type:'END_TURN'},{type:'USE_TROUBLE_CARD'},{type:'MORTGAGE',propertyId:1}])assert.throws(()=>run(s,a));
 s.players[0].isBot=true;giveRelease(s,0);assert.equal(chooseBotAction(s,{dice:[1,2],cardDraw:0}).type,'USE_TROUBLE_CARD');
});
test('bankruptcy on the third-attempt fee cancels movement and advances the turn',()=>{
 let s=setup();s.players[0].cash=0;s.players[0].detentionAttempts=2;s=run(s,{type:'ROLL_DETENTION',dice:[1,2],cardDraw:0});s=run(s,{type:'BANKRUPT'});assert.equal(s.players[0].position,10);assert.equal(s.players[0].bankrupt,true);assert.equal(s.debtContinuation,null);assert.equal(s.phase,'finished');
});
test('release cards are obtained from both original card decks',()=>{
 for(const position of [0,5]){let s=setup();s.players[0].detained=false;s.players[0].position=position;s.phase='awaiting-roll';forceNextCard(s,position===0?'Treasure':'Luck',position===0?'treasure-05':'luck-09');s=run(s,{type:'ROLL',dice:[1,1],cardDraw:5});assert.equal(s.players[0].troubleCards,1);}
});

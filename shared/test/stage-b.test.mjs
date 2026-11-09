import {forceNextCard} from './helpers.mjs';
import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,calculateRent} from '../.test-build/index.js';
const setup=()=>createGame({humanName:'Taylor',token:'circle',playerCount:3});
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('purchase validates cash, assigns ownership, decline leaves unowned',()=>{
 let s=setup();s.players[0].position=39;s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});
 assert.equal(s.phase,'actions'); // dispatch grant at space 2
 s=setup();s.players[0].position=38;s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});assert.equal(s.pendingPurchase,1);
 const bought=run(s,{type:'BUY'});assert.equal(bought.players[0].cash,1640);assert.equal(bought.ownership[1],'player-1');assert.equal(s.ownership[1],undefined);
 assert.throws(()=>run(bought,{type:'BUY'}));assert.equal(run(s,{type:'DECLINE'}).ownership[1],undefined);
 s.players[0].cash=0;assert.throws(()=>run(s,{type:'BUY'}),/Insufficient/);
});
test('rent transfers exact money and mortgages collect zero',()=>{
 let s=setup();s.ownership[3]='player-2';const rent=calculateRent(s,3);s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});assert.equal(s.players[0].cash,1500-rent);assert.equal(s.players[1].cash,1500+rent);
 s=setup();s.ownership[3]='player-2';s.properties[3]={level:0,mortgaged:true};assert.equal(calculateRent(s,3),0);s=run(s,{type:'ROLL',dice:[1,2],cardDraw:0});assert.equal(s.players[0].cash,1500);
});
test('taxes, original cards and detour are resolved centrally',()=>{
 let s=run(setup(),{type:'ROLL',dice:[2,2],cardDraw:0});assert.equal(s.players[0].cash,1300);
 s=setup();forceNextCard(s,'Treasure','treasure-07');s=run(s,{type:'ROLL',dice:[1,1],cardDraw:0});assert.equal(s.players[0].cash,1600);
 s=setup();s.players[0].position=23;s=run(s,{type:'ROLL',dice:[3,4],cardDraw:0});assert.equal(s.players[0].position,10);assert.equal(s.players[0].cash,1500);assert.equal(s.players[0].detained,true);
 s=setup();forceNextCard(s,'Luck','luck-02');s.players[0].position=1;s=run(s,{type:'ROLL',dice:[3,3],cardDraw:2});assert.equal(s.players[0].position,0);assert.equal(s.players[0].cash,1700);
});
test('transit and network rent use owner holdings and actual dice',()=>{
 const s=setup();s.ownership={5:'player-2',15:'player-2',25:'player-2',35:'player-2',12:'player-2'};
 assert.equal(calculateRent(s,5),200);assert.equal(calculateRent(s,12,9),36);
 s.ownership[28]='player-2';assert.equal(calculateRent(s,12,9),90);
 s.properties[12]={level:0,mortgaged:true};assert.equal(calculateRent(s,12,9),0);
});
test('forced inspection card never collects a passing bonus',()=>{
 let s=setup();forceNextCard(s,'Treasure','treasure-06');s.players[0].position=31;s=run(s,{type:'ROLL',dice:[1,1],cardDraw:3});
 assert.equal(s.players[0].position,10);assert.equal(s.players[0].cash,1500);assert.equal(s.players[0].detained,true);
});

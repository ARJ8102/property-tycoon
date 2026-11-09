import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,chooseBotAction} from '../.test-build/index.js';
import {nextTurn} from './helpers.mjs';
const setup=()=>{const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.phase='actions';s.ownership={1:'player-1',3:'player-1'};return s;};
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('one build on each of multiple properties is allowed, a second build is rejected atomically',()=>{
 const initial=setup();let s=run(initial,{type:'UPGRADE',propertyId:1});s=run(s,{type:'UPGRADE',propertyId:3});assert.deepEqual(s.developedThisTurn,[1,3]);assert.deepEqual(initial.developedThisTurn,[]);
 const before=structuredClone(s);assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/one development per property per turn/);assert.deepEqual(s,before);
});
test('selling and rebuilding cannot bypass the limit; it resets on the next turn',()=>{
 let s=run(setup(),{type:'UPGRADE',propertyId:1});s=run(s,{type:'SELL_UPGRADE',propertyId:1});assert.equal(s.properties[1].level,0);assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/one development/);
 s=nextTurn(s);assert.deepEqual(s.developedThisTurn,[]);s=run(s,{type:'UPGRADE',propertyId:1});assert.equal(s.properties[1].level,1);
});
test('Landmarks count as a build and selling a Landmark does not permit a rebuild',()=>{
 let s=setup();s.properties={1:{level:4,mortgaged:false},3:{level:4,mortgaged:false}};s=run(s,{type:'BUILD_LANDMARK',propertyId:1});s=run(s,{type:'SELL_LANDMARK',propertyId:1});assert.throws(()=>run(s,{type:'BUILD_LANDMARK',propertyId:1}),/one development/);
 s=nextTurn(s);s=run(s,{type:'BUILD_LANDMARK',propertyId:1});assert.equal(s.properties[1].landmark,true);
});
test('bots stop developing properties already built this turn',()=>{
 let s=setup();s.players[0].isBot=true;s.players[0].strategy='aggressive';s=run(s,{type:'UPGRADE',propertyId:1});s=run(s,{type:'UPGRADE',propertyId:3});const action=chooseBotAction(s,{dice:[1,2],cardDraw:0});assert.equal(action.type,'END_TURN');
});

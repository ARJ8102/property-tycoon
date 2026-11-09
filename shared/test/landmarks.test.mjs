import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,calculateRent,finances} from '../.test-build/index.js';
const setup=()=>{const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.ownership={1:'player-1',3:'player-1'};s.players[0].cash=3000;s.properties={1:{level:4,mortgaged:false},3:{level:4,mortgaged:false}};return s;};
const run=(s,a)=>applyAction(s,{actorId:'player-1',expectedRevision:s.revision,...a});
test('Landmarks require Level 4, a clear complete group, funds and even development',()=>{
 let s=setup();const before=calculateRent(s,1),cash=s.players[0].cash;s=run(s,{type:'BUILD_LANDMARK',propertyId:1});assert.equal(s.properties[1].landmark,true);assert.equal(s.properties[1].level,4);assert.equal(calculateRent(s,1),250);assert.ok(calculateRent(s,1)>before);assert.equal(s.players[0].cash,cash-50);
 assert.throws(()=>run(s,{type:'BUILD_LANDMARK',propertyId:1}));assert.throws(()=>run(s,{type:'MORTGAGE',propertyId:1}));assert.throws(()=>run(s,{type:'SELL_UPGRADE',propertyId:3}),/evenly/);
 for(const mutate of [s=>s.properties[3].level=3,s=>s.properties[3].mortgaged=true,s=>delete s.ownership[3],s=>s.players[0].cash=0]){s=setup();mutate(s);assert.throws(()=>run(s,{type:'BUILD_LANDMARK',propertyId:1}));}
});
test('Landmark downgrade restores Level 4, refunds half, and net worth includes it once',()=>{
 let s=setup();s=run(s,{type:'BUILD_LANDMARK',propertyId:1});assert.equal(finances(s,'player-1').developmentValue,450);const cash=s.players[0].cash;s=run(s,{type:'SELL_LANDMARK',propertyId:1});assert.equal(s.properties[1].landmark,false);assert.equal(s.properties[1].level,4);assert.equal(s.players[0].cash,cash+25);assert.equal(calculateRent(s,1),160);
 s=run(s,{type:'SELL_UPGRADE',propertyId:1});assert.throws(()=>run(s,{type:'SELL_UPGRADE',propertyId:1}),/evenly/);
});

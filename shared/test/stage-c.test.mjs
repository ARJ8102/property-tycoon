import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import {nextTurn} from './helpers.mjs';
import assert from 'node:assert/strict';
import {applyAction,calculateRent,finances} from '../.test-build/index.js';
const setup=()=>{const s=createGame({humanName:'Taylor',token:'circle',playerCount:3});s.ownership={1:'player-1',3:'player-1'};return s;};
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('mortgage principal and 10% interest, rent blocked and invalid operations rejected',()=>{
 let s=run(setup(),{type:'MORTGAGE',propertyId:1});assert.equal(s.players[0].cash,1530);assert.equal(calculateRent(s,1),0);assert.equal(finances(s,'player-1').mortgageDebt,30);
 assert.throws(()=>run(s,{type:'MORTGAGE',propertyId:1}));
 s=run(s,{type:'UNMORTGAGE',propertyId:1});assert.equal(s.players[0].cash,1497);assert.equal(s.properties[1].mortgaged,false);
 assert.throws(()=>run(s,{type:'MORTGAGE',propertyId:6}),/owner/);
});
test('complete color group, even development and even selling, four-level limit',()=>{
 let s=setup();delete s.ownership[3];assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/complete/);
 s=run(setup(),{type:'UPGRADE',propertyId:1});assert.equal(s.properties[1].level,1);assert.equal(s.players[0].cash,1450);
 assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/one development/);assert.throws(()=>run(s,{type:'MORTGAGE',propertyId:1}),/upgrades/);
 assert.ok(calculateRent(s,1)>calculateRent(setup(),1));
 s=run(s,{type:'UPGRADE',propertyId:3});s.phase='actions';s=nextTurn(s);s=run(s,{type:'UPGRADE',propertyId:1});assert.throws(()=>run(s,{type:'SELL_UPGRADE',propertyId:3}),/evenly/);
 s=run(s,{type:'SELL_UPGRADE',propertyId:1});assert.equal(s.properties[1].level,1);assert.equal(s.players[0].cash,1375);
 for(let level=1;level<4;level++){s.phase='actions';s=nextTurn(s);s=run(s,{type:'UPGRADE',propertyId:1});s=run(s,{type:'UPGRADE',propertyId:3});}
 s.phase='actions';s=nextTurn(s);assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/four/);
});
test('mortgaged group, non-city, insufficient cash cannot be upgraded',()=>{
 let s=run(setup(),{type:'MORTGAGE',propertyId:3});assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/Unmortgage/);
 s=setup();s.ownership[5]='player-1';assert.throws(()=>run(s,{type:'UPGRADE',propertyId:5}),/city/);
 s.players[0].cash=0;assert.throws(()=>run(s,{type:'UPGRADE',propertyId:1}),/Insufficient/);
});
test('redemption uses exact integer interest without floating-point overcharges',()=>{
 for(const [propertyId,expected]of [[5,1490],[12,1492],[37,1482],[39,1480]]) {
  let s=setup();s.ownership[propertyId]='player-1';s=run(s,{type:'MORTGAGE',propertyId});s=run(s,{type:'UNMORTGAGE',propertyId});assert.equal(s.players[0].cash,expected);
 }
});

import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,mortgagedProperties,finances,emitEvent} from '../.test-build/index.js';
test('bank inventory lists only mortgaged assets with the current owner',()=>{
 let s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.ownership={1:'player-1',3:'player-2'};
 s=applyAction(s,{type:'MORTGAGE',actorId:'player-1',expectedRevision:0,propertyId:1});assert.equal(mortgagedProperties(s).length,1);assert.equal(mortgagedProperties(s)[0].owner.id,'player-1');assert.equal(finances(s,'player-1').netWorth,1560);
 s=applyAction(s,{type:'UNMORTGAGE',actorId:'player-1',expectedRevision:1,propertyId:1});assert.equal(mortgagedProperties(s).length,0);
});
test('history retains the complete sequence beyond 200 events',()=>{
 const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});for(let i=0;i<250;i++)emitEvent(s,`Test ${i}`,'system');assert.equal(s.log.length,251);assert.equal(s.log[0].id,250);assert.equal(s.log.at(-1).id,0);
});

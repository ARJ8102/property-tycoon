import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rentQuote} from '../.test-build/index.js';
const setup=()=>createGame({humanName:'Taylor',token:'circle',playerCount:4});
test('board rent quotes follow city ownership, development, Landmark and mortgage state',()=>{
 const s=setup();assert.equal(rentQuote(s,1).amount,2);s.ownership={1:'player-1',3:'player-1'};assert.equal(rentQuote(s,1).amount,4);
 s.properties[1]={level:1,mortgaged:false};assert.equal(rentQuote(s,1).amount,10);s.properties[1]={level:4,landmark:true,mortgaged:false};assert.equal(rentQuote(s,1).amount,250);
 s.properties[1]={level:0,mortgaged:true};assert.deepEqual(rentQuote(s,1),{kind:'amount',amount:0,mortgaged:true});
});
test('transit quotes use owner holdings and utility quotes show the exact dice multiplier',()=>{
 const s=setup();assert.equal(rentQuote(s,5).amount,25);for(const id of [5,15,25,35])s.ownership[id]='player-1';assert.equal(rentQuote(s,5).amount,200);
 s.ownership[12]='player-1';assert.deepEqual(rentQuote(s,12),{kind:'dice',multiplier:4,mortgaged:false});s.ownership[28]='player-1';assert.equal(rentQuote(s,12).multiplier,10);
 s.ownership[28]='player-2';assert.equal(rentQuote(s,12).multiplier,4);s.properties[12]={level:0,mortgaged:true};assert.deepEqual(rentQuote(s,12),{kind:'amount',amount:0,mortgaged:true});
});

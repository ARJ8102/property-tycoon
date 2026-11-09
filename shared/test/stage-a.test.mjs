import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,rollDice} from '../.test-build/index.js';
const setup=()=>createGame({humanName:'Taylor',token:'circle',playerCount:3});
const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
test('independent dice cover 1–6 and never leave their bounds',()=>{
 let n=0;for(let i=0;i<1000;i++){const dice=rollDice(a=>{a[0]=n++%6});assert.ok(dice.every(d=>d>=1&&d<=6));assert.notEqual(dice[0],dice[1]);}
});
test('movement wraps and Launch Plaza rewards passing or landing once',()=>{
 for(const position of [36,37]) {let s=setup();s.players[0].position=position;s=run(s,{type:'ROLL',dice:[2,2],cardDraw:0});assert.equal(s.players[0].position,(position+4)%40);assert.equal(s.players[0].cash,1700);}
 assert.equal(setup().players[0].cash,1500);
});
test('normal roll gating, revision protection and player authorization',()=>{
 const s=setup(), action={type:'ROLL',dice:[1,2],cardDraw:0,actorId:s.players[0].id,expectedRevision:0};
 const next=applyAction(s,action);assert.equal(s.players[0].position,0);
 assert.throws(()=>applyAction(next,action),/stale/);
 assert.throws(()=>run(next,{type:'ROLL',dice:[1,2],cardDraw:0}),/once/);
 assert.throws(()=>applyAction(s,{...action,actorId:s.players[1].id}),/current player/);
 assert.throws(()=>run(s,{type:'END_TURN'}));
 assert.equal(run(run(next,{type:'BUY'}),{type:'END_TURN'}).currentPlayerIndex,1);
});
test('cryptographic range rejection discards biased tail values and accepts doubles',()=>{
 const samples=[0xffffffff,0,1];let calls=0;
 assert.deepEqual(rollDice(values=>{values[0]=samples[calls++];}),[1,2]);assert.equal(calls,3);
 const s=run(setup(),{type:'ROLL',dice:[2,2],cardDraw:0});assert.equal(s.currentPlayerIndex,0);
 assert.throws(()=>run(setup(),{type:'ROLL',dice:[0,7],cardDraw:0}));
 assert.throws(()=>run(setup(),{type:'ROLL',dice:new Array(2),cardDraw:0}));
});

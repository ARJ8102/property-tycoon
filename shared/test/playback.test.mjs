import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,playbackFrames} from '../.test-build/index.js';
test('playback follows forward movement across Launch Plaza and never changes outcomes',()=>{
 let s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.players[0].position=38;const next=applyAction(s,{type:'ROLL',dice:[1,2],cardDraw:0,actorId:'player-1',expectedRevision:0});const snapshot=structuredClone(next);
 const frames=playbackFrames(next.log);assert.deepEqual(frames.filter(f=>f.kind==='step').map(f=>f.position),[39,0,1]);assert.equal(frames[0].kind,'dice');assert.deepEqual(frames[1],{kind:'pause',duration:1500});assert.ok(frames.filter(f=>f.kind==='step').every(f=>f.duration===300));assert.deepEqual(next,snapshot);
});
test('direct inspection movement is a direct transition rather than a lap',()=>{
 let s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.players[0].position=28;s=applyAction(s,{type:'ROLL',dice:[1,1],cardDraw:0,actorId:'player-1',expectedRevision:0});const steps=playbackFrames(s.log).filter(f=>f.kind==='step');assert.deepEqual(steps.map(f=>f.position),[29,30,10]);assert.equal(steps.at(-1).inspection,true);assert.equal(s.players[0].cash,1500);
});
test('human and bot movement use the same 300 ms steps without changing dice or finances',()=>{
 for(const index of [0,1]){
  const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.currentPlayerIndex=index;s.players[index].position=38;
  const next=applyAction(s,{type:'ROLL',dice:[1,2],cardDraw:0,actorId:s.players[index].id,expectedRevision:s.revision});
  const steps=playbackFrames(next.log).filter(f=>f.kind==='step');assert.ok(steps.every(f=>f.duration===300&&f.actorId===s.players[index].id));assert.deepEqual(steps.map(f=>f.position),[39,0,1]);assert.deepEqual(next.dice,[1,2]);assert.equal(next.players[index].cash,1700);assert.equal(s.players[index].cash,1500);
 }
});

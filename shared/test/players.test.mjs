import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cashLeaderboard,applyAction} from '../.test-build/index.js';
test('cash leaderboard is live, stable on ties, and places eliminated players last',()=>{
 const s=createGame({humanName:'Taylor',token:'circle',playerCount:4});s.players[0].cash=900;s.players[1].cash=1600;s.players[2].cash=1400;s.players[3].cash=9000;s.players[3].bankrupt=true;
 assert.deepEqual(cashLeaderboard(s).map(p=>p.id),['player-2','player-3','player-1','player-4']);assert.equal(s.players[0].id,'player-1');
 s.players[0].cash=2000;assert.equal(cashLeaderboard(s)[0].id,'player-1');s.players[0].cash=1600;assert.equal(cashLeaderboard(s)[0].id,'player-1');
});
test('a financial transition immediately changes the cash rank without reordering player seats',()=>{
 const s=createGame({humanName:'Taylor',token:'circle',playerCount:2});s.ownership[1]='player-1';s.players[0].cash=1490;
 const next=applyAction(s,{type:'MORTGAGE',actorId:'player-1',expectedRevision:0,propertyId:1});assert.equal(cashLeaderboard(s)[0].id,'player-2');assert.equal(cashLeaderboard(next)[0].id,'player-1');assert.deepEqual(next.players.map(p=>p.id),s.players.map(p=>p.id));
});

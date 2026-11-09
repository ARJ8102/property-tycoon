import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, TOKENS, createGame } from '../.test-build/index.js';
test('board has exactly 40 consecutive spaces and four distinct corners', () => {
 assert.equal(BOARD.length, 40);
 assert.deepEqual(BOARD.map(s => s.id), Array.from({length:40}, (_,i)=>i));
 assert.equal(new Set([0,10,20,30].map(i=>BOARD[i].name)).size,4);
});
test('every setup assigns unique tokens and independent initial state', () => {
 for (const token of TOKENS) for (const playerCount of [2,3,4]) {
 const game = createGame({humanName:'  Taylor  ',token:token.id,playerCount});
 assert.equal(game.players.length,playerCount);
 assert.equal(game.players[0].name,'Taylor');
 assert.equal(game.players[0].token,token.id);
 assert.equal(game.players.filter(p=>!p.isBot).length,1);
 assert.equal(new Set(game.players.map(p=>p.token)).size,playerCount);
 assert.ok(game.players.every(p=>p.cash===1500 && p.position===0));
 assert.deepEqual(game.ownership,{});
 assert.equal(game.currentPlayerIndex,0);
 }
 const first=createGame({humanName:'One',token:'heart',playerCount:2});
 first.players[0].cash=0;
 assert.equal(createGame({humanName:'Two',token:'heart',playerCount:2}).players[0].cash,1500);
});
test('invalid setup is rejected',()=>{
 for(const playerCount of [1,5,2.5]) assert.throws(()=>createGame({humanName:'Taylor',token:'circle',playerCount}));
 for(const humanName of ['', '   ', 'a'.repeat(25)]) assert.throws(()=>createGame({humanName,token:'circle',playerCount:2}));
});

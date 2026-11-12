import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayingGame} from './helpers.mjs';
import {applyAction,presentAction,LUCK_CARDS,TREASURE_CARDS} from '../.test-build/index.js';
for(const [deck,cards,start]of [['Luck',LUCK_CARDS,4],['Treasure',TREASURE_CARDS,14]])for(const card of cards){
 test(`authoritative checkpoints preserve ${card.id}: ${card.title}`,()=>{
  const s=createPlayingGame({humanName:'Taylor',token:'circle',playerCount:3});s.players[0].position=start;
  s.decks[deck].draw=[card.id,...s.decks[deck].draw.filter(id=>id!==card.id)];
  if(card.effect.kind==='utility')s.ownership[12]=s.players[1].id;
  if(card.effect.kind==='transit')s.ownership[15]=s.players[1].id;
  const action={type:'ROLL',actorId:s.players[0].id,expectedRevision:s.revision,dice:[1,2],cardDraw:1234};
  const original=structuredClone(s),result=presentAction(s,action);
  assert.deepEqual(result.game,applyAction(s,action));assert.deepEqual(s,original);
  const p=result.presentation,index=p.steps.findIndex(step=>step.event.card?.id===card.id);
  assert.ok(index>0);assert.equal(p.steps[index].snapshot.players[0].position,start+3);
  assert.equal(p.steps[index].snapshot.players[0].cash,1500);
  assert.ok(p.steps.slice(0,index).some(step=>step.event.movement?.to===start+3));
  for(const step of p.steps){assert.equal(step.snapshot.decks,null);assert.equal(step.snapshot.debtContinuation,null);assert.deepEqual(step.snapshot.log,[]);}
  if(card.effect.kind==='back')assert.ok(p.steps.slice(index+1).some(step=>step.event.movement?.mode==='backward'&&step.event.movement.path.length===3));
  if(card.effect.kind==='lockup'){assert.equal(result.game.players[0].position,10);assert.equal(result.game.players[0].cash,1500);}
  for(const step of p.steps.filter(step=>step.event.cashTransfers))for(const transfer of step.event.cashTransfers){
   const i=p.steps.indexOf(step),previous=p.steps.slice(0,i).reverse().find(other=>!other.event.movement)?.snapshot??p.before;
   // Transfers carry authoritative amounts; presentation never draws random values or applies them.
   assert.ok(transfer.amount>=0);assert.ok(step.snapshot.players.length===previous.players.length);
  }
 });
}
test('event capture restores its observer after a rejected action',()=>{
 const s=createPlayingGame({humanName:'Taylor',token:'circle',playerCount:2});
 assert.throws(()=>presentAction(s,{type:'ROLL',actorId:'invalid',expectedRevision:0,dice:[1,2],cardDraw:0}));
 assert.deepEqual(presentAction(s,{type:'ROLL',actorId:s.players[0].id,expectedRevision:s.revision,dice:[1,2],cardDraw:0}).game,applyAction(s,{type:'ROLL',actorId:s.players[0].id,expectedRevision:s.revision,dice:[1,2],cardDraw:0}));
});
test('chained cards preserve a separate checkpoint before each effect and each individual payment',()=>{
 const s=createPlayingGame({humanName:'Taylor',token:'circle',playerCount:3});s.players[0].position=33;
 s.decks.Luck.draw=['luck-10',...s.decks.Luck.draw.filter(id=>id!=='luck-10')];s.decks.Treasure.draw=['treasure-09',...s.decks.Treasure.draw.filter(id=>id!=='treasure-09')];
 const {game,presentation:p}=presentAction(s,{type:'ROLL',actorId:s.players[0].id,expectedRevision:0,dice:[1,2],cardDraw:0});
 assert.deepEqual(p.steps.filter(s=>s.event.card).map(s=>s.event.card.id),['luck-10','treasure-09']);
 const payments=p.steps.filter(s=>s.event.cashTransfers);assert.equal(payments.length,2);
 assert.deepEqual(payments.map(s=>s.snapshot.players.map(p=>p.cash)),[[1510,1490,1500],[1520,1490,1490]]);
 assert.deepEqual(game.players.map(p=>p.cash),[1520,1490,1490]);
 assert.deepEqual(p.steps.find(s=>s.event.movement?.mode==='backward').event.movement.path,[35,34,33]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,CARD_DECKS,drawCard,holdCard,freshUtilityDice,publicGame} from '../.test-build/index.js';
export function fixture(count=3){const s=createGame({humanName:'Taylor',token:'circle',playerCount:count},1234);s.phase='awaiting-roll';s.turn=1;s.turnOrder=s.players.map(p=>p.id);s.turnSelection=null;return s;}
export function forceCard(s,deck,id){const d=s.decks[deck];d.draw=[id,...d.draw.filter(c=>c!==id),...d.discard.filter(c=>c!==id)];d.discard=[];}
export function run(s,type,extra={},actorId=s.players[s.currentPlayerIndex].id){return applyAction(s,{type,actorId,expectedRevision:s.revision,...extra});}
function land(deck,id,configure=()=>{},position){const s=fixture();forceCard(s,deck,id);s.players[0].position=position??(deck==='Luck'?4:39);configure(s);return run(s,'ROLL',{dice:[1,2],cardDraw:987654});}
const luckExpected=[['move',39],['move',0],['move',24],['move',11],['transit',15],['transit',15],['utility',12],['money',50],['trouble',1],['tax',200],['lockup',10],['repair',200],['money',-15],['move',5],['others',-100],['money',150]];
const treasureExpected=[['move',0],['money',200],['money',-50],['money',50],['trouble',1],['lockup',10],['money',100],['money',20],['others',20],['money',100],['money',-100],['money',-50],['money',25],['repair',275],['money',10],['money',100]];
for(const [deck,expectations]of [['Luck',luckExpected],['Treasure',treasureExpected]])for(const [index,[kind,value]]of expectations.entries()){
 const id=`${deck.toLowerCase()}-${String(index+1).padStart(2,'0')}`;
 test(`${id}: exact individual card effect`,()=>{
  // Treasure at 2 via 39 + 3 crosses Launch; use position 14 to reach Treasure 17 instead.
  const s=land(deck,id,s=>{if(kind==='repair'){s.ownership={1:'player-1',3:'player-1'};s.properties={1:{level:4,mortgaged:false},3:{level:4,landmark:true,mortgaged:false}};}if(kind==='transit')s.ownership[15]='player-2';if(kind==='utility')s.ownership[12]='player-2';},deck==='Treasure'?14:undefined);
  assert.ok(s.log.some(e=>e.card?.id===id));
  if(kind==='move'){assert.equal(s.players[0].position,value);assert.equal(s.players[0].cash,1500+(value===0||deck==='Luck'&&value===5?200:0));}
  if(kind==='money'||kind==='others')assert.equal(s.players[0].cash,1500+value);
  if(kind==='trouble'){assert.equal(s.players[0].troubleCards,1);assert.deepEqual(s.players[0].heldCards,[{id,deck}]);assert.ok(!s.decks[deck].draw.includes(id)&&!s.decks[deck].discard.includes(id));}
  if(kind==='tax')assert.equal(s.players[0].cash,1300);
  if(kind==='repair')assert.equal(s.players[0].cash,1500-value);
  if(kind==='lockup'){assert.equal(s.players[0].position,10);assert.equal(s.players[0].cash,1500);assert.equal(s.players[0].detained,true);}
  if(kind==='transit'){assert.equal(s.players[0].position,15);assert.equal(s.players[0].cash,1450);assert.equal(s.players[1].cash,1550);}
  if(kind==='utility'){const dice=freshUtilityDice(987654);assert.equal(s.players[0].position,12);assert.equal(s.players[0].cash,1500-10*(dice[0]+dice[1]));assert.deepEqual(s.dice,[1,2]);assert.ok(s.log.some(e=>e.dice?.join()===dice.join()));}
 });
}
test('two independent decks have exactly 16 stable unique IDs and never replace a draw',()=>{const s=fixture();assert.equal(new Set(Object.values(CARD_DECKS).flat().map(c=>c.id)).size,32);const untouched=structuredClone(s.decks.Luck),seen=[];for(let i=0;i<16;i++){const c=drawCard(s,'Treasure',i);seen.push(c.id);if(c.effect.kind==='trouble')holdCard(s.players[0],'Treasure',c.id);}assert.equal(new Set(seen).size,16);assert.deepEqual(s.decks.Luck,untouched);assert.equal(s.decks.Treasure.draw.length,0);const c=drawCard(s,'Treasure',99);assert.notEqual(c.id,'treasure-05');assert.equal(s.decks.Treasure.draw.length,14);});
test('held cards from both decks return to their own bottom and multiple players may hold cards',()=>{let s=land('Treasure','treasure-05',()=>{},14);forceCard(s,'Luck','luck-09');s.currentPlayerIndex=1;s.players[1].position=4;s.phase='awaiting-roll';s=run(s,'ROLL',{dice:[1,2],cardDraw:42});assert.equal(s.players[0].heldCards[0].deck,'Treasure');assert.equal(s.players[1].heldCards[0].deck,'Luck');for(const i of [0,1]){s.currentPlayerIndex=i;s.phase='detention';s.players[i].detained=true;s=run(s,'USE_TROUBLE_CARD');assert.equal(s.players[i].troubleCards,0);}assert.equal(s.decks.Treasure.draw.at(-1),'treasure-05');assert.equal(s.decks.Luck.draw.at(-1),'luck-09');});
test('nearest transit doubles the complete four-line rent; mortgaged special rent stays zero',()=>{let s=land('Luck','luck-05',s=>{for(const id of [5,15,25,35])s.ownership[id]='player-2';});assert.equal(s.players[0].cash,1100);s=land('Luck','luck-07',s=>{s.ownership[12]='player-2';s.properties[12]={level:0,mortgaged:true};});assert.equal(s.players[0].cash,1500);assert.equal(s.log.filter(e=>e.dice).length,1);});
test('card movement wraps forward, backward resolves Treasure, and zero repairs do not create debt',()=>{let s=land('Luck','luck-04',()=>{},33);assert.equal(s.players[0].position,11);assert.equal(s.players[0].cash,1700);s=land('Luck','luck-10',s=>forceCard(s,'Treasure','treasure-02'),33);assert.equal(s.players[0].position,33);assert.equal(s.players[0].cash,1700);assert.deepEqual(s.log.filter(e=>e.movement).find(e=>e.movement.mode==='backward').movement.path,[35,34,33]);s=land('Luck','luck-12',s=>s.players[0].cash=0);assert.equal(s.debt,null);});
test('insufficient card cash creates a pending debt and public snapshots conceal upcoming order',()=>{const s=land('Treasure','treasure-11',s=>s.players[0].cash=10,14);assert.equal(s.phase,'debt');assert.equal(s.debt.amount,100);assert.equal(s.players[0].cash,10);assert.equal(publicGame(s).decks,null);assert.ok(s.decks.Treasure.draw.length>0);});

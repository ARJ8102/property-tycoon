import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,presentAction} from '../.test-build/index.js';
import {createPlayingGame,forceNextCard,giveRelease,passAll} from './helpers.mjs';
const setup=()=>createPlayingGame({humanName:'Taylor',token:'circle',playerCount:4});
const act=(s,type,actorId=s.players[s.currentPlayerIndex].id,extra={})=>applyAction(s,{type,actorId,expectedRevision:s.revision,...extra});
test('dice crossing then a card to Launch Plaza pay twice, once per authoritative movement',()=>{
 const s=setup();s.players[0].position=38;forceNextCard(s,'Luck','luck-02');
 const action={type:'ROLL',actorId:'player-1',expectedRevision:0,dice:[4,5],cardDraw:0};
 const {game,presentation}=presentAction(s,action);
 assert.equal(game.players[0].position,0);assert.equal(game.players[0].cash,1900);
 assert.deepEqual(game.log.filter(e=>e.cashTransfers?.some(t=>t.to==='player-1')).map(e=>e.amount),[200,200]);
 assert.deepEqual(game,applyAction(s,action));assert.equal(s.players[0].cash,1500);
 assert.throws(()=>applyAction(game,action),/stale/);
 for(let replay=0;replay<3;replay++)for(const step of presentation.steps)structuredClone(step);
 assert.equal(game.players[0].cash,1900);
});
for(const [card,expected]of [['luck-10',1500],['luck-11',1700]])test(`${card} never adds a backward or Lockup bonus`,()=>{
 const s=setup();s.players[0].position=38;forceNextCard(s,'Luck',card);
 const next=act(s,'ROLL','player-1',{dice:[4,5],cardDraw:0});assert.equal(next.players[0].cash,expected);
 assert.equal(next.log.filter(e=>e.amount===200&&e.cashTransfers?.some(t=>t.to==='player-1')).length,1);
});
test('retirement returns bank assets, clears mortgages/developments, returns cards and auctions each title',()=>{
 const s=setup();s.ownership={1:'player-2',3:'player-2',5:'player-2'};
 s.properties={1:{level:4,landmark:true,mortgaged:false},3:{level:0,mortgaged:true},5:{level:0,mortgaged:false}};giveRelease(s,1);
 let next=act(s,'RETIRE','player-2');assert.equal(next.players[1].cash,0);assert.equal(next.players[1].retired,true);assert.equal(next.players[1].bankrupt,true);
 assert.deepEqual(next.ownership,{});assert.deepEqual(next.properties,{});assert.equal(next.decks.Treasure.draw.at(-1),'treasure-05');assert.equal(next.players[1].troubleCards,0);
 assert.ok(!next.turnOrder.includes('player-2'));assert.equal(next.auction.propertyId,1);assert.ok(!next.auction.participants.includes('player-2'));
 const auctioned=[];while(next.phase==='auction'){auctioned.push(next.auction.propertyId);const id=next.auction.propertyId;while(next.auction?.propertyId===id)next=act(next,'PASS_AUCTION',next.auction.currentBidderId);}
 assert.deepEqual(auctioned,[1,3,5]);assert.equal(next.phase,'awaiting-roll');assert.equal(next.currentPlayerIndex,0);assert.equal(s.players[1].bankrupt,false);
});
test('active retirement advances to the correct successor and restores its roll after auctions',()=>{
 const s=setup();s.currentPlayerIndex=1;s.ownership[1]='player-2';
 const next=passAll(act(s,'RETIRE','player-2'));assert.equal(next.currentPlayerIndex,2);assert.equal(next.phase,'awaiting-roll');assert.deepEqual(next.turnOrder,['player-1','player-3','player-4']);
});
test('retirement while owing another player uses creditor bankruptcy including mortgage inheritance and cards',()=>{
 const s=setup();s.phase='debt';s.debt={debtorId:'player-2',creditorId:'player-1',amount:5000,reason:'Rent'};s.players[1].cash=5;
 s.ownership[1]='player-2';s.properties[1]={level:0,mortgaged:true};giveRelease(s,1);
 const next=act(s,'RETIRE','player-2');assert.equal(next.ownership[1],'player-1');assert.equal(next.players[0].cash,1502);assert.equal(next.players[0].troubleCards,1);assert.equal(next.phase,'inheritance');assert.equal(next.players[1].retired,true);
});
test('solvent retirement with a pending debt does not erase creditor obligations',()=>{
 const s=setup();s.phase='debt';s.debt={debtorId:'player-2',creditorId:'player-1',amount:20,reason:'Card'};
 assert.throws(()=>act(s,'BANKRUPT','player-2'),/Raise funds/);
 const next=act(s,'RETIRE','player-2');assert.equal(next.players[0].cash,3000);assert.equal(next.players[1].cash,0);
});
test('retiring an unrelated seat preserves a pending debtor, payment queue and subsequent auctions',()=>{
 const s=setup();s.phase='debt';s.debt={debtorId:'player-2',creditorId:'player-1',amount:20,reason:'Card'};s.ownership[1]='player-3';
 let next=act(s,'RETIRE','player-3');assert.deepEqual(next.debt,s.debt);assert.equal(next.phase,'debt');
 next=act(next,'SETTLE_DEBT','player-2');assert.equal(next.players[0].cash,1520);assert.equal(next.auction.propertyId,1);next=passAll(next);assert.equal(next.phase,'actions');
});
test('retirement cancels a participating trade and restarts an auction with a departing high bidder',()=>{
 let s=setup();s.phase='actions';s=act(s,'PROPOSE_TRADE','player-1',{offer:{partnerId:'player-2',offeredCash:10,requestedCash:0,offeredProperties:[],requestedProperties:[]}});
 s=act(s,'RETIRE','player-2');assert.equal(s.trade,null);assert.equal(s.phase,'actions');
 s.phase='purchase';s.pendingPurchase=1;s=act(s,'DECLINE');s=act(s,'BID','player-1',{amount:10});s=act(s,'RETIRE','player-1');assert.equal(s.auction.highestBid,0);assert.equal(s.auction.highestBidderId,null);assert.ok(!s.auction.participants.includes('player-1'));s=passAll(s);assert.equal(s.currentPlayerIndex,2);
});
test('retirement during turn selection excludes the seat and still permits starting the game',()=>{
 const s=setup();s.players.forEach(p=>p.isBot=false);s.phase='turn-order';s.turnOrder=[];s.turnSelection={groups:[{playerIds:s.players.map(p=>p.id),round:1,rolls:{}}],history:[]};
 let next=act(s,'RETIRE','player-1');assert.equal(next.phase,'turn-order');
 for(const [id,dice]of [['player-2',[6,6]],['player-3',[4,4]],['player-4',[1,1]]])next=act(next,'ROLL_ORDER',id,{dice});
 next=act(next,'START_GAME','player-2');assert.equal(next.phase,'awaiting-roll');assert.deepEqual(next.turnOrder,['player-2','player-3','player-4']);
});
test('last remaining player wins immediately on retirement',()=>{
 let s=setup();for(const id of ['player-2','player-3','player-4'])s=act(s,'RETIRE',id);assert.equal(s.phase,'finished');assert.equal(s.winnerId,'player-1');assert.equal(s.auction,null);
});
test('retiring the last unrolled seat resolves completed scores and preserves Start Game confirmation',()=>{
 const s=setup();s.players.forEach(p=>p.isBot=false);s.phase='turn-order';s.turnOrder=[];s.currentPlayerIndex=3;
 s.turnSelection={groups:[{playerIds:s.players.map(p=>p.id),round:1,rolls:{'player-1':[6,6],'player-2':[4,4],'player-3':[1,1]}}],history:[]};
 let next=act(s,'RETIRE','player-4');assert.equal(next.phase,'order-ready');next=act(next,'RETIRE','player-1');assert.equal(next.phase,'order-ready');next=act(next,'START_GAME','player-2');assert.equal(next.currentPlayerIndex,1);
});
test('retirement without auctions leaves no continuation that could affect a later debt',()=>{
 const s=setup();let next=act(s,'RETIRE','player-1');assert.equal(next.retirementResumePhase,undefined);
 next.phase='debt';next.debt={debtorId:'player-2',creditorId:null,amount:10,reason:'Tax'};next.debtResumePhase='actions';next=act(next,'SETTLE_DEBT','player-2');assert.equal(next.phase,'actions');
});
test('an out-of-turn retirement auction restores an existing purchase decision and detained turn',()=>{
 for(const phase of ['purchase','detention']){
  const s=setup();s.phase=phase;s.pendingPurchase=phase==='purchase'?3:null;s.players[0].detained=phase==='detention';s.ownership[1]='player-2';
  const next=passAll(act(s,'RETIRE','player-2'));assert.equal(next.phase,phase);assert.equal(next.pendingPurchase,s.pendingPurchase);assert.equal(next.currentPlayerIndex,0);
 }
});
test('active retirement with bank debt auctions assets then starts its actual successor',()=>{
 const s=setup();s.currentPlayerIndex=1;s.phase='debt';s.debt={debtorId:'player-2',creditorId:null,amount:5000,reason:'Tax'};s.ownership[1]='player-2';s.players[1].cash=1;
 const next=passAll(act(s,'RETIRE','player-2'));assert.equal(next.currentPlayerIndex,2);assert.equal(next.phase,'awaiting-roll');assert.equal(next.players[1].cash,0);assert.equal(next.debt,null);
});
test('retirement during a debt trade applies the underlying creditor rules',()=>{
 let s=setup();s.ownership[1]='player-2';s.phase='debt';s.debt={debtorId:'player-2',creditorId:'player-1',amount:5000,reason:'Rent'};
 s=act(s,'PROPOSE_TRADE','player-2',{offer:{partnerId:'player-3',offeredCash:0,requestedCash:100,offeredProperties:[1],requestedProperties:[]}});
 const next=act(s,'RETIRE','player-2');assert.equal(next.players[0].cash,3000);assert.equal(next.trade,null);assert.equal(next.debt,null);
});

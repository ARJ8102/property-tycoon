import { nextOrderRoller } from './turn-order.js';
import { actionError, activePlayer, actingPlayer } from './engine.js';
import { calculateRent, developmentRank, getProperty, groupProperties, ownedProperties, propertyStatus, unmortgageCost } from './finance.js';
import { botAcceptsTrade } from './trading.js';
import type { GameAction, GameState } from './types.js';
export interface BotEntropy { dice: [number,number]; cardDraw: number }
/** One deterministic decision per call. The client schedules each decision separately. */
export function chooseBotAction(state: GameState, entropy: BotEntropy): GameAction | null {
 if(state.phase==='finished'||state.phase==='order-ready')return null;
 if(state.phase==='turn-order'){
  const roller=nextOrderRoller(state);
  return roller?.isBot?{type:'ROLL_ORDER',actorId:roller.id,expectedRevision:state.revision,dice:entropy.dice}:null;
 }
 if(state.phase==='inheritance'&&state.inheritances[0]){const player=actingPlayer(state);if(!player.isBot)return null;const propertyId=state.inheritances[0].propertyIds[0]!,property=getProperty(state,propertyId);return {type:player.cash-property.price/2>=250?'REDEEM_INHERITED':'KEEP_INHERITED',actorId:player.id,expectedRevision:state.revision,propertyId};}
 if(state.phase==='auction'&&state.auction){const a=state.auction,player=actingPlayer(state);if(!player.isBot)return null;const property=getProperty(state,a.propertyId),reserve=player.strategy==='conservative'?350:player.strategy==='aggressive'?80:200;const limit=Math.min(player.cash-reserve,Math.floor(property.price*(player.strategy==='aggressive'?1.2:player.strategy==='strategic'?1.1:.85)));const amount=Math.min(a.highestBid+10,limit);return amount>a.highestBid?{type:'BID',amount,actorId:player.id,expectedRevision:state.revision}:{type:'PASS_AUCTION',actorId:player.id,expectedRevision:state.revision};}
 if(state.phase==='trade'&&state.trade) {
  const responder=state.players.find(p=>p.id===state.trade!.partnerId)!;
  if(!responder.isBot||responder.bankrupt)return null;
  return {actorId:responder.id,expectedRevision:state.revision,type:botAcceptsTrade(state,state.trade.proposerId,state.trade)?'ACCEPT_TRADE':'REJECT_TRADE',tradeId:state.trade.id};
 }
 const player=actingPlayer(state);
 if(!player.isBot||player.bankrupt)return null;
 const context={actorId:player.id,expectedRevision:state.revision};
 const owned=ownedProperties(state,player.id);
 if(state.phase==='detention') {
  if(player.troubleCards>0)return {...context,type:'USE_TROUBLE_CARD'};
  const reserve=player.strategy==='conservative'?350:player.strategy==='aggressive'?100:200;
  if(player.cash>=reserve+50 || (player.detentionAttempts>=2&&player.cash>=50))return {...context,type:'PAY_RELEASE'};
  return {...context,type:'ROLL_DETENTION',dice:entropy.dice,cardDraw:entropy.cardDraw};
 }
 if(state.phase==='awaiting-roll')return {...context,type:'ROLL',dice:entropy.dice,cardDraw:entropy.cardDraw};
 if(state.phase==='purchase'&&state.pendingPurchase!==null) {
  const property=getProperty(state,state.pendingPurchase);
  let reserve=player.strategy==='conservative'?350:player.strategy==='aggressive'?80:200;
  const completes=property.kind==='property'&&groupProperties(state,property).every(p=>p.id===property.id||state.ownership[p.id]===player.id);
  if(player.strategy==='strategic'&&completes)reserve=100;
  const affordable=player.cash-property.price>=reserve;
  const cautious=player.strategy!=='conservative'||property.price<=240||completes;
  return {...context,type:affordable&&cautious?'BUY':'DECLINE'};
 }
 if(state.phase==='debt'&&state.debt) {
  if(player.cash>=state.debt.amount)return {...context,type:'SETTLE_DEBT'};
  const sales=owned.filter(p=>developmentRank(propertyStatus(state,p.id))>0).sort((a,b)=>developmentRank(propertyStatus(state,b.id))-developmentRank(propertyStatus(state,a.id)));
  for(const p of sales){const a:GameAction={...context,type:propertyStatus(state,p.id).landmark?'SELL_LANDMARK':'SELL_UPGRADE',propertyId:p.id};if(!actionError(state,a))return a;}
  for(const p of [...owned].sort((a,b)=>b.price-a.price)){const a:GameAction={...context,type:'MORTGAGE',propertyId:p.id};if(!actionError(state,a))return a;}
  return {...context,type:'BANKRUPT'};
 }
 if(state.phase==='actions') {
  if(state.extraRoll)return {...context,type:'ROLL',dice:entropy.dice,cardDraw:entropy.cardDraw};
  const reserve=player.strategy==='conservative'?450:player.strategy==='aggressive'?120:250;
  // Restore rent before buying improvements. Each action spends cash, so this terminates.
  for(const p of owned) if(propertyStatus(state,p.id).mortgaged&&player.cash-unmortgageCost(p)>=reserve) {
   const a:GameAction={...context,type:'UNMORTGAGE',propertyId:p.id};if(!actionError(state,a))return a;
  }
  const ordered=[...owned].sort((a,b)=>player.strategy==='strategic'?calculateRent(state,b.id)-calculateRent(state,a.id):a.price-b.price);
  for(const p of ordered) if(p.kind==='property'&&player.cash-(propertyStatus(state,p.id).level===4?p.landmarkCost:p.upgradeCost)>=reserve) {
   const a:GameAction={...context,type:propertyStatus(state,p.id).level===4?'BUILD_LANDMARK':'UPGRADE',propertyId:p.id};if(!actionError(state,a))return a;
  }
  return {...context,type:'END_TURN'};
 }
 return null;
}

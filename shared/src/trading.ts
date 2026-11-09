import { groupProperties, getProperty, mortgageValue, ownedProperties, propertyStatus } from './finance.js';
import type { GameState, TradeOffer } from './types.js';
/** Validate the entire proposal before changing either player's assets. */
export function validateTrade(state: GameState, proposerId: string, offer: TradeOffer): void {
 const from=state.players.find(p=>p.id===proposerId), to=state.players.find(p=>p.id===offer.partnerId);
 if(!from||!to||from.id===to.id||from.bankrupt||to.bankrupt)throw new Error('Choose another active trading partner.');
 for(const cash of [offer.offeredCash,offer.requestedCash]) if(!Number.isSafeInteger(cash)||cash<0)throw new Error('Trade cash must be a nonnegative whole number.');
 if(from.cash<offer.offeredCash||to.cash<offer.requestedCash)throw new Error('A trading player has insufficient cash.');
 if(state.debt?.debtorId===proposerId&&(offer.offeredProperties.length===0||offer.requestedCash<=offer.offeredCash))throw new Error('A liquidation trade must exchange your property for an immediate net cash payment.');
 const ids=[...offer.offeredProperties,...offer.requestedProperties];
 if(!ids.length&&!offer.offeredCash&&!offer.requestedCash)throw new Error('Include cash or a property in the trade.');
 if(new Set(ids).size!==ids.length)throw new Error('A property cannot appear twice in a trade.');
 for(const [list,ownerId] of [[offer.offeredProperties,from.id],[offer.requestedProperties,to.id]] as const) {
  for(const id of list) {
   if(!Number.isInteger(id))throw new Error('Invalid trade property.');
   const property=getProperty(state,id);
   if(state.ownership[id]!==ownerId)throw new Error('Trade property ownership has changed.');
   if((propertyStatus(state,id).level>0||propertyStatus(state,id).landmark))throw new Error('Sell upgrades before trading a property.');
   // Trading a bare city out of an improved group would break development rules.
   if(property.kind==='property'&&groupProperties(state,property).some(p=>(propertyStatus(state,p.id).level>0||propertyStatus(state,p.id).landmark)))throw new Error('Sell group upgrades before trading a city.');
  }
 }
}
/** Rule-based bot valuation: mortgage principal reduces value; complete groups add value. */
export function botAcceptsTrade(state: GameState, proposerId: string, offer: TradeOffer): boolean {
 try {validateTrade(state,proposerId,offer);}catch{return false;}
 const bot=state.players.find(p=>p.id===offer.partnerId)!;
 if(!bot.isBot)return false;
 const reserve=bot.strategy==='conservative'?300:bot.strategy==='aggressive'?75:180;
 if(bot.cash-offer.requestedCash+offer.offeredCash<reserve)return false;
 const after=new Set(ownedProperties(state,bot.id).map(p=>p.id));
 offer.requestedProperties.forEach(id=>after.delete(id));offer.offeredProperties.forEach(id=>after.add(id));
 const value=(id:number,gaining:boolean)=>{
  const p=getProperty(state,id);
  let amount=p.price-(propertyStatus(state,id).mortgaged?mortgageValue(p):0);
  if(p.kind==='property') {
   const group=groupProperties(state,p);
   const complete=gaining?group.every(s=>after.has(s.id)):group.every(s=>state.ownership[s.id]===bot.id);
   if(complete)amount+=p.price*(bot.strategy==='strategic'?.75:.4);
   else if(gaining&&group.some(s=>state.ownership[s.id]===bot.id))amount+=p.price*.12;
  }
  return amount;
 };
 const received=offer.offeredCash+offer.offeredProperties.reduce((sum,id)=>sum+value(id,true),0);
 const given=offer.requestedCash+offer.requestedProperties.reduce((sum,id)=>sum+value(id,false),0);
 const threshold=bot.strategy==='conservative'?1.12:bot.strategy==='aggressive'?.95:1.03;
 return received>0&&received>=given*threshold;
}

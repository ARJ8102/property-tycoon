import type { EventCategory, EventDetails, GameEvent, GameState } from './types.js';
import { calculateRent, isPurchasable, propertyStatus } from './finance.js';
import { collectionInfo, collectionKey, collectionProperties } from './groups.js';
export const EVENT_LABELS: Record<EventCategory,string> = {auctions:'Auctions',movement:'Movement',purchases:'Purchases',rent:'Rent',trades:'Trades',mortgages:'Mortgages',developments:'Developments',taxes:'Taxes',cards:'Cards',inspection:'Lockup',bankruptcy:'Bankruptcy',turns:'Turns',groups:'Collections',winner:'Winner',penalties:'Payment / action',system:'Table'};
/** Event IDs define ordering. No clocks, random values, or UI-generated game text. */
export function emitEvent(state: GameState, message: string, category: EventCategory='system', data: EventDetails={}) {
 const actorId=data.actorId??state.players[state.currentPlayerIndex]!.id;
 const event: GameEvent={...data,id:(state.log[0]?.id??0)+1,turn:state.turn,category,actorId,actorName:state.players.find(p=>p.id===actorId)?.name??'Table',message};
 state.log.unshift(event);
}
export function formatGameEvent(event: GameEvent): string { return event.message; }
export function announceCollections(before: GameState, after: GameState) {
 const seen=new Set<string>();
 for(const property of after.spaces.filter(isPurchasable)) {
  const key=collectionKey(property);if(seen.has(key))continue;seen.add(key);
  const old=collectionInfo(before,property.id),current=collectionInfo(after,property.id);
  const oldOwner=old.complete?before.ownership[property.id]:undefined,newOwner=current.complete?after.ownership[property.id]:undefined;
  if(oldOwner===newOwner)continue;
  if(oldOwner)emitEvent(after,`${after.players.find(p=>p.id===oldOwner)!.name} no longer owns the complete ${key} collection. Rent has been recalculated.`,'groups',{actorId:oldOwner});
  if(newOwner) {
   const members=collectionProperties(after,property),rents=members.filter(p=>!propertyStatus(after,p.id).mortgaged&&propertyStatus(after,p.id).level===0).map(p=>({propertyId:p.id,amount:calculateRent(after,p.id)}));
   const eligible=rents.map(r=>`${after.spaces[r.propertyId]!.name} $${r.amount}`).join(', ');
   emitEvent(after,`${after.players.find(p=>p.id===newOwner)!.name} now owns every property in the ${key} ${property.kind==='property'?'group':'collection'}! ${property.kind==='property'?`Unimproved rent is doubled on eligible properties${eligible?`: ${eligible}`:': none are currently eligible'}.`:`Current rents${property.kind==='utility'?' for a roll of 7':''}: ${eligible}.`}`,'groups',{actorId:newOwner,rents});
  }
 }
}
export function recordRejectedAction(state: GameState, actorId: string, reason: string):GameState {
 const next={...state,log:[...state.log]};
 emitEvent(next,`${state.players.find(p=>p.id===actorId)?.name??'Player'}’s action was not completed: ${reason}`,'penalties',{actorId});
 return next;
}

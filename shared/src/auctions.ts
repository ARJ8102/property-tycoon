import type {GameState,GameAction} from './types.js';
import {getProperty} from './finance.js';
import {emitEvent} from './events.js';
export interface Auction {propertyId:number;participants:string[];currentBidderId:string;highestBid:number;highestBidderId:string|null}
export function startAuction(state:GameState,propertyId:number,firstId=state.players[state.currentPlayerIndex]!.id){
 const property=getProperty(state,propertyId);if(state.ownership[propertyId])throw new Error('Only unowned properties may be auctioned.');
 const ids=(state.turnOrder.length?state.turnOrder:state.players.map(p=>p.id)).filter(id=>!state.players.find(p=>p.id===id)!.bankrupt);
 const offset=Math.max(0,ids.indexOf(firstId)),participants=[...ids.slice(offset),...ids.slice(0,offset)];
 if(!participants.length)return;
 state.auction={propertyId,participants,currentBidderId:participants[0]!,highestBid:0,highestBidderId:null};state.phase='auction';
 emitEvent(state,`The bank opens an auction for ${property.name}. Each active player may bid or pass.`,'auctions',{propertyId});
}
/** Returns true only once the auction has atomically completed. */
export function auctionAction(state:GameState,action:Extract<GameAction,{type:'BID'|'PASS_AUCTION'}>):boolean {
 const a=state.auction;if(state.phase!=='auction'||!a)throw new Error('No auction is pending.');
 if(a.currentBidderId!==action.actorId||!a.participants.includes(action.actorId))throw new Error('Wait for your auction turn.');
 const player=state.players.find(p=>p.id===action.actorId)!;if(player.bankrupt)throw new Error('Eliminated players cannot bid.');
 const order=[...a.participants],index=order.indexOf(player.id),property=getProperty(state,a.propertyId);
 if(action.type==='BID'){
  if(!Number.isSafeInteger(action.amount)||action.amount<=a.highestBid||action.amount<=0)throw new Error('Bid a positive whole amount above the current bid.');
  if(action.amount>player.cash)throw new Error('A bid cannot exceed your available cash.');
  a.highestBid=action.amount;a.highestBidderId=player.id;emitEvent(state,`${player.name} bids $${action.amount} for ${property.name}.`,'auctions',{actorId:player.id,propertyId:property.id,amount:action.amount});
 }else{a.participants=a.participants.filter(id=>id!==player.id);emitEvent(state,`${player.name} passes on ${property.name} and leaves this auction.`,'auctions',{actorId:player.id,propertyId:property.id});}
 if(!a.participants.length||a.participants.length===1&&a.highestBidderId===a.participants[0]){
  if(a.highestBidderId){
   const winner=state.players.find(p=>p.id===a.highestBidderId)!;if(winner.cash<a.highestBid||winner.bankrupt)throw new Error('Auction winner cannot fund the bid.');
   winner.cash-=a.highestBid;state.ownership[property.id]=winner.id;state.properties[property.id]={level:0,mortgaged:false};
   emitEvent(state,`${winner.name} wins ${property.name} at auction for $${a.highestBid}.`,'auctions',{actorId:winner.id,propertyId:property.id,amount:a.highestBid,propertyTransfers:[{propertyId:property.id,from:null,to:winner.id}],cashTransfers:[{from:winner.id,to:null,amount:a.highestBid}]});
  }else emitEvent(state,`${property.name} remains unowned after everyone passes.`,'auctions',{propertyId:property.id});
  state.auction=null;state.phase='actions';return true;
 }
 for(let step=1;step<=order.length;step++){const id=order[(index+step)%order.length]!;if(a.participants.includes(id)&&id!==a.highestBidderId){a.currentBidderId=id;return false;}}
 throw new Error('Auction has no authorized next bidder.');
}

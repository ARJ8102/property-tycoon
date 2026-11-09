import type { GameState, OrderGroup, Player } from './types.js';
import { emitEvent } from './events.js';
export function isOrderPhase(state:GameState):boolean{return state.phase==='turn-order'||state.phase==='order-ready';}
export function nextOrderRoller(state:GameState):Player|null {
 if(state.phase!=='turn-order'||!state.turnSelection)return null;
 for(const group of state.turnSelection.groups){
  if(group.playerIds.length===1)continue;
  const id=group.playerIds.find(playerId=>!group.rolls[playerId]);
  if(id)return state.players.find(p=>p.id===id)??null;
 }
 return null;
}
/** Split only the rolling group. Other score groups keep their established slots. */
export function recordOrderRoll(state:GameState, actorId:string,dice:[number,number]):void {
 if(state.phase!=='turn-order'||nextOrderRoller(state)?.id!==actorId||!state.turnSelection)throw new Error('Wait for your turn-order roll.');
 if(!Array.isArray(dice)||dice.length!==2||![dice[0],dice[1]].every(n=>Number.isInteger(n)&&n>=1&&n<=6))throw new Error('Invalid dice.');
 const selection=state.turnSelection;
 const index=selection.groups.findIndex(g=>g.playerIds.length>1&&g.playerIds.includes(actorId)&&!g.rolls[actorId]);
 const group=selection.groups[index]!;
 group.rolls[actorId]=[...dice];
 selection.history.push({playerId:actorId,dice:[...dice],total:dice[0]+dice[1],round:group.round});
 const actor=state.players.find(p=>p.id===actorId)!;
 emitEvent(state,`${actor.name} rolled ${dice[0]} + ${dice[1]} = ${dice[0]+dice[1]} for turn order${group.round>1?` (tie-break round ${group.round})`:''}.`,'turns',{actorId});
 if(group.playerIds.every(id=>group.rolls[id])){
  const scores=new Map<number,string[]>();
  for(const id of group.playerIds){const pair=group.rolls[id]!,total=pair[0]+pair[1];scores.set(total,[...(scores.get(total)??[]),id]);}
  const parts:OrderGroup[]=[...scores.entries()].sort(([a],[b])=>b-a).map(([,playerIds])=>({playerIds,round:group.round+1,rolls:{}}));
  selection.groups.splice(index,1,...parts);
  for(const part of parts.filter(p=>p.playerIds.length>1))emitEvent(state,`Turn-order tie: ${part.playerIds.map(id=>state.players.find(p=>p.id===id)!.name).join(', ')} must reroll within their tied position.`,'turns',{actorId});
 }
 if(selection.groups.every(g=>g.playerIds.length===1)){
  state.turnOrder=selection.groups.flatMap(g=>g.playerIds);
  if(state.turnOrder.length!==state.players.length||new Set(state.turnOrder).size!==state.players.length)throw new Error('Invalid final turn order.');
  state.phase='order-ready';state.currentPlayerIndex=state.players.findIndex(p=>p.id===state.turnOrder[0]);
  emitEvent(state,`Final turn order: ${state.turnOrder.map((id,i)=>`${i+1}. ${state.players.find(p=>p.id===id)!.name}`).join(' · ')}. Confirm Start Game to begin.`,'turns',{actorId});
 }else{
  const next=nextOrderRoller(state)!;state.currentPlayerIndex=state.players.findIndex(p=>p.id===next.id);
 }
}
export function nextTurnPlayer(state:GameState):Player|null {
 if(state.phase==='finished'||!state.turnOrder.length)return null;
 const current=state.players[state.currentPlayerIndex]!.id,slot=state.turnOrder.indexOf(current);
 for(let offset=1;offset<state.turnOrder.length;offset++){
  const player=state.players.find(p=>p.id===state.turnOrder[(slot+offset)%state.turnOrder.length]);
  if(player&&!player.bankrupt)return player;
 }
 return null;
}

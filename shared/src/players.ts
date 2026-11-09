import type { GameState } from './types.js';
/** Cash ranking is a presentation view, independent of the fixed turn sequence. */
export function cashLeaderboard(state:GameState){
 const seats=new Map(state.players.map((player,index)=>[player.id,index]));
 return [...state.players].sort((a,b)=>Number(a.bankrupt)-Number(b.bankrupt)||b.cash-a.cash||seats.get(a.id)!-seats.get(b.id)!);
}

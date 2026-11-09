import {applyAction,createGame as createNewGame} from '../.test-build/index.js';
/** Pass opponents through actual neutral-space rolls to reach this player's next turn. */
export function nextTurn(state){
 const original=state.players[state.currentPlayerIndex].id;
 const run=(s,a)=>applyAction(s,{actorId:s.players[s.currentPlayerIndex].id,expectedRevision:s.revision,...a});
 state=run(state,{type:'END_TURN'});
 while(state.players[state.currentPlayerIndex].id!==original){
  if(state.phase==='detention')state=run(state,{type:'PAY_RELEASE'});
  state=run(state,{type:'ROLL',dice:[4,6],cardDraw:0});
  if(state.phase==='purchase')state=run(state,{type:'DECLINE'});
  state=run(state,{type:'END_TURN'});
 }
 return state;
}

/** Post-confirmation state fixture for tests that target existing gameplay mechanics. */
export function createPlayingGame(setup){
 const s=createNewGame(setup,1234);s.phase='awaiting-roll';s.turn=1;s.turnOrder=s.players.map(p=>p.id);s.turnSelection=null;
 return s;
}
export function forceNextCard(state,deck,id){const d=state.decks[deck];d.draw=[id,...d.draw.filter(c=>c!==id),...d.discard.filter(c=>c!==id)];d.discard=[];}
export function giveRelease(state,index,deck='Treasure'){const id=deck==='Treasure'?'treasure-05':'luck-09';state.decks[deck].draw=state.decks[deck].draw.filter(c=>c!==id);state.decks[deck].discard=state.decks[deck].discard.filter(c=>c!==id);state.players[index].heldCards.push({id,deck});state.players[index].troubleCards=state.players[index].heldCards.length;}
export function passAll(state){while(state.phase==='auction')state=applyAction(state,{type:'PASS_AUCTION',actorId:state.auction.currentBidderId,expectedRevision:state.revision});return state;}

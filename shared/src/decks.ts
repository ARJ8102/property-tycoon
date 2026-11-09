import {CARD_DECKS,type DeckName,type GameCard} from './cards.js';
import type {GameState,Player} from './types.js';
export interface DeckState {draw:string[];discard:string[]}
export interface HeldCard {id:string;deck:DeckName}
/** Local deterministic entropy stream, seeded only by a trusted random input. Never broadcast the seed/order. */
export function entropyStream(seed:number){let value=seed>>>0;return()=>{value=(value+0x6d2b79f5)>>>0;let n=value;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return (n^(n>>>14))>>>0;};}
function bounded(next:()=>number,bound:number){const limit=Math.floor(0x100000000/bound)*bound;let n:number;do{n=next();}while(n>=limit);return n%bound;}
function shuffle(ids:readonly string[],seed:number|(()=>number)){const result=[...ids],next=typeof seed==='function'?seed:entropyStream(seed);for(let i=result.length-1;i>0;i--){const j=bounded(next,i+1);[result[i],result[j]]=[result[j]!,result[i]!];}return result;}
export function createDecks(seed:number|(()=>number)):Record<DeckName,DeckState>{return {Treasure:{draw:shuffle(CARD_DECKS.Treasure.map(c=>c.id),seed),discard:[]},Luck:{draw:shuffle(CARD_DECKS.Luck.map(c=>c.id),typeof seed==='function'?seed:seed^0x9e3779b9),discard:[]}};}
export function drawCard(state:GameState,deckName:DeckName,seed:number|(()=>number)):GameCard {
 if(!state.decks)throw new Error('Only the authoritative game can draw cards.');
 const deck=state.decks[deckName];
 if(!deck.draw.length){deck.draw=shuffle(deck.discard,seed);deck.discard=[];}
 const id=deck.draw.shift();const card=CARD_DECKS[deckName].find(c=>c.id===id);if(!card)throw new Error('No drawable card in this deck.');
 if(card.effect.kind!=='trouble')deck.discard.push(card.id);
 return card;
}
export function holdCard(player:Player,deck:DeckName,id:string){player.heldCards.push({id,deck});player.troubleCards=player.heldCards.length;}
export function returnHeldCard(state:GameState,player:Player){const held=player.heldCards.shift();if(!held)throw new Error('No held release card is available.');if(state.decks)state.decks[held.deck].draw.push(held.id);player.troubleCards=player.heldCards.length;return held;}
export function freshUtilityDice(seed:number,source?:()=>number):[number,number]{const next=source??entropyStream(seed^0xa5f0319d);return [bounded(next,6)+1,bounded(next,6)+1];}
export function repairBill(state:GameState,playerId:string,development:number,landmark:number){return Object.entries(state.ownership).filter(([,owner])=>owner===playerId).reduce((sum,[id])=>{const status=state.properties[Number(id)];return sum+(status?.landmark?landmark:(status?.level??0)*development);},0);}
/** Upcoming order and deferred random inputs are private, even in reconnect snapshots. */
export function publicGame(state:GameState):GameState{return {...state,decks:null,debtContinuation:null};}

import {applyAction} from './engine.js';
import {publicGame} from './decks.js';
import {observeGameEvents} from './events.js';
import type {GameAction,GameEvent,GameState} from './types.js';
export interface PresentationStep {event:GameEvent;snapshot:GameState}
export interface CardPresentation {revision:number;before:GameState;steps:PresentationStep[];acknowledged:number[]}
const snapshot=(state:GameState)=>structuredClone({...publicGame(state),log:[]});
/** Capture public, authoritative checkpoints while the unchanged atomic transition runs once. */
export function presentAction(before:GameState,action:GameAction):{game:GameState;presentation:CardPresentation|null} {
 const steps:PresentationStep[]=[];
 const game=observeGameEvents(()=>applyAction(before,action),(state,event)=>steps.push({event:structuredClone(event),snapshot:snapshot(state)}));
 // Launch rewards are logged just before their movement; present them after arrival.
 for(let i=0;i<steps.length-1;i++)if(steps[i]!.event.cashTransfers&&steps[i]!.event.category==='movement'&&steps[i+1]!.event.movement){
  [steps[i],steps[i+1]]=[steps[i+1]!,steps[i]!];i++;
 }
 return {game,presentation:steps.some(s=>s.event.card)?{revision:game.revision,before:snapshot(before),steps,acknowledged:[]}:null};
}
export function presentationDuration(step:PresentationStep):number {
 const e=step.event;
 return e.card?0:e.movement?e.movement.path.length*300+500:e.dice?1850:e.cashTransfers?1200:500;
}
export function nextPresentationCard(p:CardPresentation){return p.steps.find(s=>s.event.card&&!p.acknowledged.includes(s.event.id))?.event;}
export function presentationSegmentDuration(p:CardPresentation,afterId?:number):number {
 let duration=0,started=afterId===undefined;
 for(const step of p.steps){if(!started){if(step.event.id===afterId)started=true;continue;}if(step.event.card)break;duration+=presentationDuration(step);}
 return duration;
}

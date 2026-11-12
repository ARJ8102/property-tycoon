import {useEffect,useRef,useState} from 'react';
import type {CardPresentation,GameEvent,GameState} from '@property-tycoon/shared';
import {useReducedMotion} from './usePresentation';
const positions=(s:GameState)=>Object.fromEntries(s.players.map(p=>[p.id,p.position]));
/** Play server-captured checkpoints. This hook never runs a game transition. */
export function useCardPlayback(batch:CardPresentation|null|undefined,generation:number,remoteContinue?: (revision:number,eventId:number)=>Promise<boolean>){
 const reduced=useReducedMotion(),latest=useRef(batch);latest.current=batch;
 const initialBatch=useRef(batch?.revision);
 const localAcknowledged=useRef({revision:batch?.revision,ids:new Set<number>()});
 const gate=useRef<{id:number;resolve:()=>void}|null>(null),sending=useRef(false);
 const [view,setView]=useState<{revision:number;snapshot:GameState;positions:Record<string,number>;dice:GameState['dice'];rolling:boolean;event:GameEvent|null;landing:number|null;done:boolean}|null>(null);
 const [submitted,setSubmitted]=useState(false);
 useEffect(()=>{
  if(!batch){setView(null);return;}
  if(localAcknowledged.current.revision!==batch.revision)localAcknowledged.current={revision:batch.revision,ids:new Set()};
  let cancelled=false;const timers=new Map<number,()=>void>();
  const wait=(ms:number)=>new Promise<void>(resolve=>{const id=window.setTimeout(()=>{timers.delete(id);resolve();},ms);timers.set(id,resolve);});
  setView({revision:batch.revision,snapshot:batch.before,positions:positions(batch.before),dice:batch.before.dice,rolling:false,event:null,landing:null,done:false});
  void(async()=>{
   const resumeAt=remoteContinue&&initialBatch.current===batch.revision?batch.steps.findIndex(s=>s.event.card&&!batch.acknowledged.includes(s.event.id)):0;
   for(const {event,snapshot} of resumeAt<0?[]:batch.steps.slice(resumeAt)){
    if(cancelled)return;
    if(event.card){
     setView(v=>v&&({...v,snapshot,positions:positions(snapshot),dice:snapshot.dice,event,landing:null}));
     if(!latest.current?.acknowledged.includes(event.id)&&!localAcknowledged.current.ids.has(event.id)){
      sending.current=false;setSubmitted(false);
      await new Promise<void>(resolve=>{gate.current={id:event.id,resolve};});
      if(cancelled)return;gate.current=null;
     }else await wait(reduced?100:500);
     setView(v=>v&&({...v,event:null}));
    }else if(event.movement){
     setView(v=>v&&({...v,event:null,landing:null}));
     for(const position of event.movement.path){
      if(cancelled)return;
      setView(v=>v&&({...v,positions:{...v.positions,[event.actorId!]:position}}));
      await wait(reduced?0:300);
     }
     if(cancelled)return;
     const landing={...event,message:`${event.actorName} landed on ${snapshot.spaces[event.movement.to]!.name}.`};
     setView(v=>v&&({...v,snapshot,event:landing,landing:event.movement!.to}));await wait(reduced?100:500);
    }else if(event.dice){
     setView(v=>v&&({...v,rolling:!reduced,event:null,landing:null}));await wait(reduced?0:350);if(cancelled)return;
     const diceEvent=event.category==='movement'?{...event,message:`${event.actorName} rolled ${event.dice[0]} + ${event.dice[1]} = ${event.dice[0]+event.dice[1]}.`}:event;
     setView(v=>v&&({...v,dice:event.dice!,rolling:false,event:diceEvent}));await wait(reduced?100:1500);
    }else{
     setView(v=>v&&({...v,snapshot,event,landing:null}));await wait(reduced?100:event.cashTransfers?1200:500);
    }
   }
   if(!cancelled)setView(v=>v&&({...v,done:true,event:null,landing:null,rolling:false}));
  })();
  return()=>{cancelled=true;gate.current?.resolve();gate.current=null;for(const [timer,resolve]of timers){clearTimeout(timer);resolve();}};
  // Presence and acknowledgments update latest without restarting an in-progress sequence.
 },[batch?.revision,generation,reduced]);
 useEffect(()=>{const pending=gate.current;if(pending&&batch?.acknowledged.includes(pending.id)){pending.resolve();}},[batch]);
 const continueCard=async()=>{
  const pending=gate.current;if(!pending||sending.current||!batch)return;
  sending.current=true;setSubmitted(true);
  if(remoteContinue){const ok=await remoteContinue(batch.revision,pending.id);if(!ok){sending.current=false;setSubmitted(false);}}
  else{localAcknowledged.current.ids.add(pending.id);pending.resolve();gate.current=null;}
 };
 const active=!!batch&&(!view||view.revision!==batch.revision||!view.done);
 return {active,view:view?.revision===batch?.revision?view:null,continueCard,submitted,reduced};
}

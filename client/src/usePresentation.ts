import { useEffect, useRef, useState } from 'react';
import { playbackFrames, type GameState } from '@property-tycoon/shared';
function positions(game:GameState|null):Record<string,number>{return Object.fromEntries(game?.players.map(p=>[p.id,p.position])??[]);}
function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return reduced;
}
export function usePresentation(game:GameState|null,generation:number){
 const reduced=useReducedMotion();
 const seen=useRef({generation,id:game?.log[0]?.id??0});
 const [visual,setVisual]=useState({generation,snapshot:game,positions:positions(game),dice:game?.dice??null,rolling:false,busy:false,inspection:false});
 const incoming=game?.log.filter(e=>seen.current.generation===generation&&e.id>seen.current.id)??[];
 const pending=!reduced&&playbackFrames(incoming).length>0;
 useEffect(()=>{
  if(!game||reduced||seen.current.generation!==generation){seen.current={generation,id:game?.log[0]?.id??0};setVisual({generation,snapshot:game,positions:positions(game),dice:game?.dice??null,rolling:false,busy:false,inspection:false});return;}
  const events=game.log.filter(e=>e.id>seen.current.id);seen.current.id=game.log[0]?.id??0;
  const frames=playbackFrames(events);
  if(!frames.length){setVisual(current=>({...current,generation,snapshot:game,positions:positions(game),dice:game.dice}));return;}
  let cancelled=false;const timers:number[]=[];
  const wait=(duration:number)=>new Promise<void>(resolve=>{timers.push(window.setTimeout(resolve,duration));});
  void(async()=>{
   setVisual(current=>({...current,busy:true}));
   for(const frame of frames){
    if(cancelled)return;
    if(frame.kind==='dice'){
     setVisual(current=>({...current,rolling:true}));await wait(frame.duration);if(cancelled)return;
     setVisual(current=>({...current,rolling:false,dice:frame.dice}));
    }else if(frame.kind==='pause'){await wait(frame.duration);}
    else{
     setVisual(current=>({...current,positions:{...current.positions,[frame.actorId]:frame.position},inspection:frame.inspection}));await wait(frame.duration);
    }
   }
   if(!cancelled)setVisual({generation,snapshot:game,positions:positions(game),dice:game.dice,rolling:false,busy:false,inspection:false});
  })();
  return()=>{cancelled=true;timers.forEach(window.clearTimeout);};
 },[game?.log,generation,reduced,game]);
 const immediate=reduced||visual.generation!==generation;
 const busy=!immediate&&(pending||visual.busy);
 return {game:busy?(visual.snapshot??game):game,positions:immediate?positions(game):visual.positions,dice:immediate?game?.dice??null:visual.dice,rolling:!immediate&&visual.rolling,busy,inspection:!immediate&&visual.inspection,reduced};
}

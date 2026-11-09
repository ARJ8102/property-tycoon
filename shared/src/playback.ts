import type { GameEvent } from './types.js';
export const MOVEMENT_STEP_MS=300 as const;
export type PlaybackFrame = {kind:'dice';actorId:string;dice:[number,number];duration:350}|{kind:'pause';duration:1500}|{kind:'step';actorId:string;position:number;inspection:boolean;duration:typeof MOVEMENT_STEP_MS};
/** Derived presentation only: consuming frames never changes authoritative game state. */
export function playbackFrames(events: readonly GameEvent[]): PlaybackFrame[] {
 return [...events].sort((a,b)=>a.id-b.id).flatMap((event):PlaybackFrame[]=>{
  const frames:PlaybackFrame[]=[];if(!event.actorId)return frames;
  if(event.dice)frames.push({kind:'dice',actorId:event.actorId,dice:[...event.dice],duration:350},{kind:'pause',duration:1500});
  if(event.movement)for(const position of event.movement.path)frames.push({kind:'step',actorId:event.actorId,position,inspection:event.movement.mode==='direct'&&position===10,duration:MOVEMENT_STEP_MS});
  return frames;
 });
}
